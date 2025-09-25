// Global variables
let playerName = '';
// NEW GOOGLE APPS SCRIPT URL - YOU NEED TO CREATE THIS
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzyJAaLoaMxIHfi5KAXirKDnRJk8Ts6UxJ2igNgS_ffdajondsEuQnjOt3t6ET2jKrv/exec';

// Name input functionality
document.getElementById('nameInputForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const nameInput = document.getElementById('playerName').value.trim();
  
  if (nameInput) {
    playerName = nameInput;
    
    // Display player name on intro screen
    document.getElementById('displayPlayerName').textContent = playerName;
    document.getElementById('currentPlayerName').textContent = playerName;
    
    // Hide name input screen
    document.getElementById('nameInputScreen').style.display = 'none';
    // Show intro screen
    document.getElementById('introScreen').style.display = 'flex';
    
    // Create floating particles for intro
    createIntroParticles();
  }
});

// Start button on intro screen
document.getElementById('startBtn').addEventListener('click', function() {
  document.getElementById('introScreen').style.display = 'none';
  document.getElementById('gameContainer').style.display = 'block';
  initGame();
});

// Game over popup functionality
function showGameOverPopup(score) {
  // Save score to Google Sheets
  saveScoreToSheet(playerName, score);
  
  // Display player's score
  document.getElementById('playerScoreDisplay').textContent = `${playerName}: ${score} points`;
  
  // Show loading state
  const topScoresList = document.getElementById('topScoresList');
  topScoresList.innerHTML = '<div class="loading-spinner">Loading scores...</div>';
  topScoresList.className = 'scores-loading';
  
  // Fetch and display top scores
  fetchTopScores().then(topScores => {
    // Remove loading class
    topScoresList.className = '';
    
    if (topScores.length === 0) {
      topScoresList.innerHTML = '<div class="score-item">No scores yet!</div>';
    } else {
      topScoresList.innerHTML = '';
      topScores.forEach((scoreItem, index) => {
        const scoreElement = document.createElement('div');
        scoreElement.className = 'score-item';
        scoreElement.innerHTML = `
          <span>${index + 1}. ${scoreItem.name}</span>
          <span>${scoreItem.score} pts</span>
        `;
        topScoresList.appendChild(scoreElement);
      });
    }
  }).catch(error => {
    // Handle error case
    topScoresList.className = '';
    topScoresList.innerHTML = '<div class="score-item">Error loading scores</div>';
    console.error('Error fetching scores:', error);
  });
  
  // Show the popup
  document.getElementById('gameOverPopup').style.display = 'flex';
}

// Play again button functionality
document.getElementById('playAgainBtn').addEventListener('click', function() {
  // Hide the game over popup and game container
  document.getElementById('gameOverPopup').style.display = 'none';
  document.getElementById('gameContainer').style.display = 'none';
  
  // Show the name input screen for the next player
  document.getElementById('nameInputScreen').style.display = 'flex';
  
  // Reset the player name input and focus on it for the next player
  document.getElementById('playerName').value = '';
  document.getElementById('playerName').focus();
  
  // Reset game state completely for the next player
  resetGame();
});

// NEW SIMPLIFIED Google Sheets API functions
async function saveScoreToSheet(name, score) {
  try {
    const form = new URLSearchParams();
    form.append("name", name);
    form.append("score", String(score));
    form.append("timestamp", new Date().toISOString());

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: form.toString()
    });

    const result = await response.json();
    console.log("Save response:", result);

    return result.success || false;
  } catch (error) {
    console.error("Save error:", error);
    saveScoreToLocalStorage(name, score); // fallback
    return false;
  }
}

async function fetchTopScores() {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, { method: "GET" });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const result = await response.json();
    console.log("Fetched scores:", result);

    return result.topScores || [];
  } catch (error) {
    console.error("Fetch error:", error);
    return getTopScoresFromLocalStorage();
  }
}

    // ========== GAME LOGIC ==========
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    const scoreElement = document.getElementById("score");
    const ballsLeftElement = document.getElementById("ballsLeft");
    const powerFillElement = document.getElementById("powerFill");
    const resetBtn = document.getElementById("resetBtn");
    const colorDots = document.querySelectorAll('.color-dot');

    // Game constants
    const BALL_RADIUS = 10;
    const CUP_RADIUS = 25;
    const CUP_HEIGHT = 40;
    const GRAVITY = 0.2;
    const FRICTION = 0.98;

    // Character properties
    const CHAR_WIDTH = 40;
    const CHAR_HEIGHT = 90;
    const CHAR_SPEED = 3;

    // Game state
    let score = 0;
    let totalCups = 10;
    let ballsLeft = 10;
    let cups = [];
    let ball = null;
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let dragEnd = { x: 0, y: 0 };
    let power = 0;
    let cupColor = 'red';
    let gameActive = true;
    let lastTime = 0;
    let particles = [];
    let trajectoryPoints = [];
    let characterX = 200;
    let characterY = 500;
    let armAngle = 0;
    let armSwingDirection = 1;
    let keys = {};
    window.shiftKey = false;
    let ballInMotion = false;
    let gameTime = 0;

    // Separation line
    const SEPARATION_LINE_X = canvas.width / 2;

    // Cup movement patterns
    const MOVEMENT_PATTERNS = {
      HORIZONTAL: 'horizontal',
      VERTICAL: 'vertical',
      CIRCULAR: 'circular',
      FIGURE_EIGHT: 'figure_eight',
      BOUNCE: 'bounce'
    };

    // Initialize cups with different movement patterns and BIGGER movements
    function initCups() {
      cups = [];
      const patterns = Object.values(MOVEMENT_PATTERNS);
      const startX = canvas.width - 200; // More space for bigger movements
      const startY = 100; // Higher starting position
      const cupSpacing = 60; // More spacing between cups
      
      for (let i = 0; i < totalCups; i++) {
        const pattern = patterns[i % patterns.length];
        const baseX = startX + (i % 3) * 120; // More horizontal spread
        const baseY = startY + Math.floor(i / 3) * cupSpacing;
        
        cups.push({
          x: baseX,
          y: baseY,
          baseX: baseX,
          baseY: baseY,
          radius: CUP_RADIUS,
          height: CUP_HEIGHT,
          filled: false,
          color: cupColor,
          pattern: pattern,
          speed: 0.8 + Math.random() * 0.8, // Faster speeds for bigger movements
          angle: Math.random() * Math.PI * 2,
          timeOffset: Math.random() * 100,
          amplitude: 80 + Math.random() * 80, // MUCH bigger movement range (80-160 pixels)
          bounceVelocity: 0,
          bounceHeight: 100 + Math.random() * 80 // Bigger bounce height
        });
      }
    }

    // Update cup positions with BIGGER movements
    function updateCups(deltaTime) {
      gameTime += deltaTime / 1000;
      
      cups.forEach(cup => {
        if (cup.filled) return;
        
        const time = gameTime + cup.timeOffset;
        
        switch(cup.pattern) {
          case MOVEMENT_PATTERNS.HORIZONTAL:
            cup.x = cup.baseX + Math.sin(time * cup.speed) * cup.amplitude;
            break;
            
          case MOVEMENT_PATTERNS.VERTICAL:
            cup.y = cup.baseY + Math.sin(time * cup.speed) * cup.amplitude;
            break;
            
          case MOVEMENT_PATTERNS.CIRCULAR:
            cup.x = cup.baseX + Math.cos(time * cup.speed) * cup.amplitude;
            cup.y = cup.baseY + Math.sin(time * cup.speed) * cup.amplitude * 0.8; // Slightly elliptical
            break;
            
          case MOVEMENT_PATTERNS.FIGURE_EIGHT:
            cup.x = cup.baseX + Math.sin(time * cup.speed) * cup.amplitude;
            cup.y = cup.baseY + Math.sin(time * cup.speed * 2) * cup.amplitude * 0.6;
            break;
            
          case MOVEMENT_PATTERNS.BOUNCE:
            // Bigger bouncing physics
            cup.bounceVelocity += 0.15; // Stronger gravity for bigger bounces
            cup.y += cup.bounceVelocity;
            
            // Floor collision with bigger bounce area
            if (cup.y > cup.baseY + cup.bounceHeight) {
              cup.y = cup.baseY + cup.bounceHeight;
              cup.bounceVelocity = -Math.abs(cup.bounceVelocity) * 0.85; // More energetic bounce
              
              // Create bigger particle effect when bouncing
              if (Math.abs(cup.bounceVelocity) > 0.5) {
                createExplosion(cup.x, cup.y + cup.height, '#FFFFFF', 6);
              }
            }
            
            // Also add some horizontal movement to bouncing cups
            cup.x = cup.baseX + Math.sin(time * cup.speed * 0.5) * (cup.amplitude * 0.3);
            break;
        }
        
        // Keep cups within larger bounds to accommodate bigger movements
        cup.x = Math.max(cup.radius + 30, Math.min(canvas.width - cup.radius - 30, cup.x));
        cup.y = Math.max(cup.radius + 30, Math.min(canvas.height - cup.height - 30, cup.y));
      });
    }

    // Create a new ball
    function createBall() {
      if (ballsLeft <= 0) return;
      
      ball = {
        x: characterX + 15,
        y: characterY - 30,
        radius: BALL_RADIUS,
        vx: 0,
        vy: 0,
        active: true,
        held: true
      };
      
      ballsLeft--;
      ballsLeftElement.textContent = ballsLeft;
      ballInMotion = false;
    }

    // Draw separation line
    function drawSeparationLine() {
      ctx.save();
      
      // Dashed center line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(SEPARATION_LINE_X, 0);
      ctx.lineTo(SEPARATION_LINE_X, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // "NO CROSS" text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.save();
      ctx.translate(SEPARATION_LINE_X, canvas.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('NO CROSS LINE', 0, 0);
      ctx.restore();
      
      ctx.restore();
    }

    // Mario-style character (restricted to left side of separation line)
    function drawPlayer() {
      ctx.save();
      
      // Keep character on left side of separation line
  const maxX = SEPARATION_LINE_X - CHAR_WIDTH / 2 - 10;
  if (characterX > maxX) {
    characterX = maxX;
  }
  
  // FIXED: Only move arms when aiming/dragging
  if (isDragging) {
    // Calculate arm angle based on drag direction for realistic aiming
    const dx = dragEnd.x - ball.x;
    const dy = dragEnd.y - ball.y;
    armAngle = Math.atan2(dy, dx) - Math.PI; // Point arm towards drag direction
  } else if (!ballInMotion) {
    armAngle = 0; // Reset arm to neutral position when not aiming or throwing
  }
      
      // Draw shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(characterX, characterY + 15, CHAR_WIDTH/2, CHAR_WIDTH/6, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Body (overalls)
      ctx.fillStyle = '#E52521';
      ctx.fillRect(characterX - CHAR_WIDTH/2, characterY - CHAR_HEIGHT, CHAR_WIDTH, CHAR_HEIGHT);
      
      // Overalls straps
      ctx.fillStyle = '#2160DE';
      ctx.fillRect(characterX - CHAR_WIDTH/2, characterY - CHAR_HEIGHT, 10, 30);
      ctx.fillRect(characterX + CHAR_WIDTH/2 - 10, characterY - CHAR_HEIGHT, 10, 30);
      
      // Overalls buttons
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(characterX - 5, characterY - CHAR_HEIGHT + 45, 3, 0, Math.PI * 2);
      ctx.arc(characterX + 5, characterY - CHAR_HEIGHT + 45, 3, 0, Math.PI * 2);
      ctx.fill();
      
      // Head
      ctx.fillStyle = '#F9CF00';
      ctx.beginPath();
      ctx.arc(characterX, characterY - CHAR_HEIGHT - 15, 20, 0, Math.PI * 2);
      ctx.fill();
      
      // Hat
      ctx.fillStyle = '#E52521';
      ctx.fillRect(characterX - 20, characterY - CHAR_HEIGHT - 35, 40, 10);
      ctx.fillRect(characterX - 15, characterY - CHAR_HEIGHT - 45, 30, 15);
      
      // Hat emblem
      ctx.fillStyle = 'white';
      ctx.font = '10px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('M', characterX, characterY - CHAR_HEIGHT - 38);
      
      // Eyes
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(characterX - 7, characterY - CHAR_HEIGHT - 18, 4, 0, Math.PI * 2);
      ctx.arc(characterX + 7, characterY - CHAR_HEIGHT - 18, 4, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(characterX - 5, characterY - CHAR_HEIGHT - 18, 2, 0, Math.PI * 2);
      ctx.arc(characterX + 5, characterY - CHAR_HEIGHT - 18, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Eye highlights
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(characterX - 6, characterY - CHAR_HEIGHT - 19, 1, 0, Math.PI * 2);
      ctx.arc(characterX + 6, characterY - CHAR_HEIGHT - 19, 1, 0, Math.PI * 2);
      ctx.fill();
      
      // Mustache
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(characterX, characterY - CHAR_HEIGHT - 8, 15, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Nose
      ctx.fillStyle = '#F9CF00';
      ctx.beginPath();
      ctx.arc(characterX, characterY - CHAR_HEIGHT - 10, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Mouth
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(characterX, characterY - CHAR_HEIGHT - 3, 5, 0, Math.PI);
      ctx.fill();
      
      // Arms
      ctx.fillStyle = '#F9CF00';
      
      // Left arm
      ctx.save();
      ctx.translate(characterX - 25, characterY - CHAR_HEIGHT + 20);
      ctx.rotate(-armAngle);
      ctx.fillRect(0, 0, 15, 8);
      ctx.beginPath();
      ctx.ellipse(0, 4, 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      // Right arm (throwing arm)
      ctx.save();
      ctx.translate(characterX + 10, characterY - CHAR_HEIGHT + 20);
      ctx.rotate(armAngle);
      ctx.fillRect(0, 0, 15, 8);
      ctx.beginPath();
      ctx.ellipse(0, 4, 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      // Legs
      ctx.fillStyle = '#2160DE';
      ctx.fillRect(characterX - 15, characterY - 10, 12, 25);
      ctx.fillRect(characterX + 3, characterY - 10, 12, 25);
      
      // Shoes
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(characterX - 17, characterY + 15, 16, 8);
      ctx.fillRect(characterX + 1, characterY + 15, 16, 8);
      
      ctx.restore();
    }

    // Realistic beer pong cups with movement indicators
    function drawCups() {
      cups.forEach(cup => {
        ctx.save();
        
        let cupBaseColor;
        if (cup.filled) {
          cupBaseColor = '#94a3b8';
        } else {
          switch(cup.color) {
            case 'blue': cupBaseColor = '#3498db'; break;
            case 'red': cupBaseColor = '#e74c3c'; break;
            case 'green': cupBaseColor = '#2ecc71'; break;
            case 'yellow': cupBaseColor = '#f1c40f'; break;
          }
        }
        
        const cupBottomRadius = cup.radius * 0.7;
        
        const gradient = ctx.createLinearGradient(
          cup.x - cup.radius, cup.y,
          cup.x + cup.radius, cup.y
        );
        gradient.addColorStop(0, cup.filled ? '#cbd5e1' : lightenColor(cupBaseColor, 30));
        gradient.addColorStop(0.5, cupBaseColor);
        gradient.addColorStop(1, cup.filled ? '#94a3b8' : darkenColor(cupBaseColor, 20));
        
        ctx.fillStyle = gradient;
        
        ctx.beginPath();
        ctx.moveTo(cup.x - cup.radius, cup.y);
        ctx.lineTo(cup.x - cupBottomRadius, cup.y + cup.height);
        ctx.lineTo(cup.x + cupBottomRadius, cup.y + cup.height);
        ctx.lineTo(cup.x + cup.radius, cup.y);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.ellipse(cup.x, cup.y, cup.radius, cup.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.ellipse(cup.x, cup.y + cup.height, cupBottomRadius, cupBottomRadius * 0.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Movement pattern indicator (bigger and more visible)
        if (!cup.filled) {
          ctx.fillStyle = getPatternColor(cup.pattern);
          ctx.beginPath();
          ctx.arc(cup.x, cup.y - 20, 6, 0, Math.PI * 2); // Bigger indicator
          ctx.fill();
          
          // Add a glow effect to make it more visible
          ctx.shadowColor = getPatternColor(cup.pattern);
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(cup.x, cup.y - 20, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        
        if (cup.filled) {
          const beerGradient = ctx.createLinearGradient(
            cup.x, cup.y,
            cup.x, cup.y + cup.height * 0.7
          );
          beerGradient.addColorStop(0, '#FFD700');
          beerGradient.addColorStop(1, '#D4AF37');
          
          ctx.beginPath();
          ctx.moveTo(cup.x - cup.radius * 0.8, cup.y + 5);
          ctx.lineTo(cup.x - cupBottomRadius * 0.8, cup.y + cup.height * 0.7);
          ctx.lineTo(cup.x + cupBottomRadius * 0.8, cup.y + cup.height * 0.7);
          ctx.lineTo(cup.x + cup.radius * 0.8, cup.y + 5);
          ctx.closePath();
          ctx.fillStyle = beerGradient;
          ctx.fill();
          
          ctx.beginPath();
          ctx.ellipse(cup.x, cup.y + 5, cup.radius * 0.8, cup.radius * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 248, 231, 0.9)';
          ctx.fill();
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.arc(
              cup.x - cup.radius * 0.6 + Math.random() * cup.radius * 1.2, 
              cup.y + 10 + Math.random() * cup.height * 0.6, 
              1 + Math.random() * 2, 
              0, 
              Math.PI * 2
            );
            ctx.fill();
          }
        }
        
        ctx.restore();
      });
    }

    // Helper function to get color for movement pattern indicator
    function getPatternColor(pattern) {
      switch(pattern) {
        case MOVEMENT_PATTERNS.HORIZONTAL: return '#FF6B6B';
        case MOVEMENT_PATTERNS.VERTICAL: return '#4ECDC4';
        case MOVEMENT_PATTERNS.CIRCULAR: return '#45B7D1';
        case MOVEMENT_PATTERNS.FIGURE_EIGHT: return '#96CEB4';
        case MOVEMENT_PATTERNS.BOUNCE: return '#FECA57';
        default: return '#FFFFFF';
      }
    }

    // Helper functions for colors
    function lightenColor(color, percent) {
      const num = parseInt(color.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = Math.min(255, ((num >> 16) & 0xff) + amt);
      const G = Math.min(255, ((num >> 8) & 0xff) + amt);
      const B = Math.min(255, (num & 0xff) + amt);
      return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
    }

    function darkenColor(color, percent) {
      const num = parseInt(color.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = Math.max(0, ((num >> 16) & 0xff) - amt);
      const G = Math.max(0, ((num >> 8) & 0xff) - amt);
      const B = Math.max(0, (num & 0xff) - amt);
      return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
    }

    // Draw ball
    function drawBall() {
      if (!ball || !ball.active) return;
      
      ctx.save();
      
      if (ball.held) {
        ball.x = characterX + 15 + Math.cos(armAngle) * 15;
        ball.y = characterY - 60 + Math.sin(armAngle) * 15;
      }
      
      // Shadow
      ctx.beginPath();
      ctx.arc(ball.x, ball.y + 2, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fill();
      
      const gradient = ctx.createRadialGradient(
        ball.x - ball.radius/3, ball.y - ball.radius/3, 1,
        ball.x, ball.y, ball.radius
      );
      gradient.addColorStop(0, '#ff6b6b');
      gradient.addColorStop(1, '#E52521');
      
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(ball.x - ball.radius/3, ball.y - ball.radius/3, ball.radius/3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fill();
      
      ctx.fillStyle = 'white';
      ctx.font = `${ball.radius}px 'Press Start 2P'`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('M', ball.x, ball.y);
      
      ctx.restore();
    }

    // Draw aiming line
    function drawAimingLine() {
      if (!isDragging || !ball) return;
      
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(dragEnd.x, dragEnd.y);
      ctx.stroke();
      
      const dx = ball.x - dragEnd.x;
      const dy = ball.y - dragEnd.y;
      const dist = Math.min(Math.sqrt(dx*dx + dy*dy), 100);
      power = dist / 100;
      
      powerFillElement.style.width = `${power * 100}%`;
      ctx.restore();
    }

    // Draw trajectory prediction
    function drawTrajectory() {
      if (!isDragging || !ball) return;
      
      trajectoryPoints = [];
      const dx = (ball.x - dragEnd.x) * 0.1;
      const dy = (ball.y - dragEnd.y) * 0.1;
      
      let predX = ball.x;
      let predY = ball.y;
      let predVx = dx;
      let predVy = dy;
      
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(predX, predY);
      
      for (let i = 0; i < 100; i++) {
        predVy += GRAVITY;
        predX += predVx;
        predY += predVy;
        predVx *= FRICTION;
        predVy *= FRICTION;
        
        trajectoryPoints.push({x: predX, y: predY});
        ctx.lineTo(predX, predY);
        
        if (predY > canvas.height - BALL_RADIUS) break;
      }
      
      ctx.stroke();
      
      for (let i = 0; i < trajectoryPoints.length; i += 5) {
        ctx.beginPath();
        ctx.arc(trajectoryPoints[i].x, trajectoryPoints[i].y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
        ctx.fill();
      }
      
      ctx.restore();
    }

    // Draw particles
    function drawParticles() {
      particles.forEach((p, index) => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.alpha -= 0.01;
        
        if (p.alpha <= 0) {
          particles.splice(index, 1);
        }
      });
    }

    // Create explosion particles
    function createExplosion(x, y, color, count) {
      for (let i = 0; i < count; i++) {
        particles.push({
          x: x,
          y: y,
          vx: (Math.random() - 0.5) * 5,
          vy: (Math.random() - 0.5) * 5,
          size: Math.random() * 3 + 1,
          color: color,
          alpha: 1
        });
      }
    }

    // Update ball physics
    function updateBall() {
      if (!ball || !ball.active || ball.held) return;
      
      ballInMotion = true;
      ball.vy += GRAVITY;
      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.vx *= FRICTION;
      ball.vy *= FRICTION;
      
      // Floor collision
      if (ball.y > canvas.height - ball.radius) {
        ball.y = canvas.height - ball.radius;
        ball.vy = -ball.vy * 0.6;
        
        if (Math.abs(ball.vy) < 0.5) {
          ball.active = false;
          ballInMotion = false;
          
          setTimeout(() => {
            if (ballsLeft > 0) {
              createBall();
            }
          }, 1000);
        }
      }
      
      // Wall collisions
      if (ball.x < ball.radius) {
        ball.x = ball.radius;
        ball.vx = -ball.vx * 0.8;
      } else if (ball.x > canvas.width - ball.radius) {
        ball.x = canvas.width - ball.radius;
        ball.vx = -ball.vx * 0.8;
      }
      
      // Cup collisions
      cups.forEach(cup => {
        if (cup.filled) return;
        
        const cupBottomRadius = cup.radius * 0.7;
        const cupSlope = (cup.radius - cupBottomRadius) / cup.height;
        
        const dx = ball.x - cup.x;
        const dy = ball.y - cup.y;
        
        const cupRadiusAtBallY = cup.radius - cupSlope * dy;
        const distance = Math.sqrt(dx*dx);
        
        if (dy > 0 && dy < cup.height && distance < cupRadiusAtBallY) {
          cup.filled = true;
          score++;
          scoreElement.textContent = score;
          
          createExplosion(cup.x, cup.y, '#2ecc71', 25); // Bigger explosion for bigger movements
          
          ball.active = false;
          ballInMotion = false;
          
          if (score >= totalCups) {
            setTimeout(() => {
              alert('YOU WIN! Perfect game! That was challenging with all that movement!');
              resetGame();
            }, 1000);
          }
          
          setTimeout(() => {
            if (ballsLeft > 0) {
              createBall();
            }
          }, 500);
        }
      });
      
      // Check for game over
      if (!ball.active && !ballInMotion && ballsLeft <= 0 && score < totalCups) {
        setTimeout(() => {
          showGameOverPopup(score);
        }, 1000);
      }
    }

    // Update character position (restricted to left side)
    function updateCharacter() {
      const maxX = SEPARATION_LINE_X - CHAR_WIDTH / 2 - 10;
      
      if (keys['a'] || keys['ArrowLeft']) {
        characterX -= CHAR_SPEED;
        if (characterX < CHAR_WIDTH/2) characterX = CHAR_WIDTH/2;
      }
      if (keys['d'] || keys['ArrowRight']) {
        characterX += CHAR_SPEED;
        if (characterX > maxX) characterX = maxX;
      }
      if (keys['w'] || keys['ArrowUp']) {
        characterY -= CHAR_SPEED;
        if (characterY < CHAR_HEIGHT + 20) characterY = CHAR_HEIGHT + 20;
      }
      if (keys['s'] || keys['ArrowDown']) {
        characterY += CHAR_SPEED;
        if (characterY > canvas.height - 10) characterY = canvas.height - 10;
      }
    }

    // Reset the game
    function resetGame() {
    score = 0;
    ballsLeft = 10;
    gameTime = 0;
    gameActive = true;
    ballInMotion = false;
  
  // Reset UI elements
  scoreElement.textContent = score;
  ballsLeftElement.textContent = ballsLeft;
  powerFillElement.style.width = '0%';
  
  // Reset cups and create new ball
  initCups();
  
  // Clear any existing ball
  ball = null;
  
  // Reset character position
  characterX = 200;
  characterY = 500;
  armAngle = 0;
  
  // Clear particles and trajectory
  particles = [];
  trajectoryPoints = [];
  
  // Reset keys state
  keys = {};
  window.shiftKey = false;
}

    // Game loop
    function gameLoop(timestamp) {
      const deltaTime = timestamp - lastTime;
      lastTime = timestamp;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      updateCharacter();
      updateCups(deltaTime);
      
      // Draw floor
      ctx.fillStyle = '#4a7c59';
      ctx.fillRect(0, canvas.height - 20, canvas.width, 20);
      
      drawSeparationLine();
      drawCups();
      drawPlayer();
      
      if (ball) {
        updateBall();
        drawBall();
      }
      
      drawAimingLine();
      if (isDragging && window.shiftKey) {
        drawTrajectory();
      }
      
      drawParticles();
      
      requestAnimationFrame(gameLoop);
    }

    // Initialize game
    function initGame() {
      initCups();
      createBall();
      
      // Event listeners
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mouseup', handleMouseUp);
      
      resetBtn.addEventListener('click', resetGame);
      
      // Remove new ball button
      const newBallBtn = document.getElementById("newBallBtn");
      if (newBallBtn) {
        newBallBtn.style.display = "none";
      }
      
     // Keyboard events
      window.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        
        // Prevent Sticky Keys popup when Shift is pressed
        if (e.key === 'Shift') {
          window.shiftKey = true;
          e.preventDefault(); // This prevents the Sticky Keys dialog
        }
        
        // Additional prevention for repeated Shift presses
        if (e.key === 'Shift' && e.repeat) {
          e.preventDefault();
        }
      });

      window.addEventListener('keyup', (e) => {
        keys[e.key] = false;
        if (e.key === 'Shift') window.shiftKey = false;
      }); 
      
      // Cup color selection
      colorDots.forEach(dot => {
        dot.addEventListener('click', () => {
          colorDots.forEach(d => d.classList.remove('active'));
          dot.classList.add('active');
          cupColor = dot.getAttribute('data-color');
          initCups();
        });
      });
      
      requestAnimationFrame(gameLoop);
    }

    // Enhanced mouse event handlers with power control
function handleMouseDown(e) {
  if (!ball || !ball.active || !ball.held || ballInMotion) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  isDragging = true;
  isAiming = true;
  dragStart.x = x; // Start from click position
  dragStart.y = y;
  dragEnd.x = x; // Initially same as start
  dragEnd.y = y;
}

function handleMouseMove(e) {
  if (!isDragging) return;
  
  const rect = canvas.getBoundingClientRect();
  dragEnd.x = e.clientX - rect.left;
  dragEnd.y = e.clientY - rect.top;
  
  // Calculate power based on drag distance from ball
  const dx = ball.x - dragEnd.x;
  const dy = ball.y - dragEnd.y;
  const dist = Math.min(Math.sqrt(dx*dx + dy*dy), 150); // Increased max distance
  power = dist / 150;
  
  powerFillElement.style.width = `${power * 100}%`;
}

function handleMouseUp() {
  if (!isDragging || !ball) return;
  
  isDragging = false;
  isAiming = false;
  
  // Calculate direction from ball to drag end (reverse of typical drag)
  const dx = (ball.x - dragEnd.x) * 0.1 * power;
  const dy = (ball.y - dragEnd.y) * 0.1 * power;
  
  ball.vx = dx;
  ball.vy = dy;
  ball.held = false;
  
  powerFillElement.style.width = '0%';
}

// Enhanced aiming feedback
function drawAimingFeedback() {
  if (!isDragging || !ball) return;
  
  ctx.save();
  
  // Draw connection line from ball to drag point
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(ball.x, ball.y);
  ctx.lineTo(dragEnd.x, dragEnd.y);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Draw power indicator at drag point
  const powerRadius = 5 + (power * 15);
  const gradient = ctx.createRadialGradient(
    dragEnd.x, dragEnd.y, 0,
    dragEnd.x, dragEnd.y, powerRadius
  );
  gradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
  gradient.addColorStop(1, 'rgba(255, 215, 0, 0.2)');
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(dragEnd.x, dragEnd.y, powerRadius, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw crosshair
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(dragEnd.x - 8, dragEnd.y);
  ctx.lineTo(dragEnd.x + 8, dragEnd.y);
  ctx.moveTo(dragEnd.x, dragEnd.y - 8);
  ctx.lineTo(dragEnd.x, dragEnd.y + 8);
  ctx.stroke();
  
  ctx.restore();
}
    // Also allow starting with Enter key on name input
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && document.getElementById('nameInputScreen').style.display === 'flex') {
        document.getElementById('nameInputForm').dispatchEvent(new Event('submit'));
      }

    });

