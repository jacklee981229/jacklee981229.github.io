// Declare the confetti array using const
const confettis = [];

// Animate the falling confettis using an arrow function
const animateConfettis = () => {
  for (let i = 0; i < confettis.length; i++) {
    const confetti = confettis[i];
    
    // Remove confettis that have fallen out of the screen
    if (confetti.y >= window.innerHeight) {
      confetti.el.remove();
      confettis.splice(i, 1);
      i--;
    }
    // Animate existing confettis
    else {
      confetti.y += confetti.vy;
      confetti.x += confetti.vx;
      confetti.vy += 0.5;
      confetti.el.style.cssText = `left:${confetti.x}px;top:${confetti.y}px;background:${confetti.color};transform:rotate(${confetti.angle}deg);z-index:99999`;
    }
  }
  
  requestAnimationFrame(animateConfettis);
};

// Handle click events on the page using an arrow function
const handlePageClick = () => {
  const previousClickHandler = window.onclick;

  window.onclick = (e) => {
    // Call any previous click handler
    if (previousClickHandler) {
      previousClickHandler(e);
    }
    
    // Add a new confetti where the user clicked
    const confetti = document.createElement("div");
    confetti.className = "confetti";
    
    const newConfetti = {
      el: confetti,
      x: e.clientX,
      y: e.clientY,
      vx: Math.random() * 8 - 4,
      vy: Math.random() * 8 - 4,
      angle: Math.random() * 360,
      color: getRandomColor(),
    };
    
    confettis.push(newConfetti);
    document.body.appendChild(confetti);
  };
};

// Add a click event handler to the page to start the animation
handlePageClick();

// Start the animation loop
animateConfettis();

// Inject CSS rules to style the confetti element
const css = `
  .confetti {
    width: 10px;
    height: 10px;
    position: fixed;
    background: #f00;
    border-radius: 50%;
  }
`;

const injectConfettiStyles = (css) => {
  const style = document.createElement("style");
  style.type = "text/css";
  
  try {
    style.appendChild(document.createTextNode(css));
  } catch (e) {
    style.styleSheet.cssText = css;
  }
  
  document.head.appendChild(style);
};

injectConfettiStyles(css);

// Generate a random RGB color string using an arrow function
const getRandomColor = () => {
  return `rgb(${~~(255 * Math.random())},${~~(255 * Math.random())},${~~(255 * Math.random())})`;
};
