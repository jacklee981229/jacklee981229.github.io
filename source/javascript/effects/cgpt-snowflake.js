// Declare the snowflakes array using const
const snowflakes = [];

// Animate the falling snowflakes using an arrow function
const animateSnowflakes = () => {
  for (let i = 0; i < snowflakes.length; i++) {
    const snowflake = snowflakes[i];

    // Remove snowflakes that have fallen off the page
    if (snowflake.y > window.innerHeight) {
      snowflake.el.remove();
      snowflakes.splice(i, 1);
      i--;
    }
    // Animate existing snowflakes
    else {
      snowflake.y += snowflake.speed;
      snowflake.el.style.cssText = `left:${snowflake.x}px;top:${snowflake.y}px;font-size:${snowflake.size}px;color:${snowflake.color};z-index:99999`;
    }
  }

  requestAnimationFrame(animateSnowflakes);
};

// Handle click events on the page using an arrow function
const handlePageClick = () => {
  const previousClickHandler = window.onclick;

  window.onclick = (e) => {
    // Call any previous click handler
    if (previousClickHandler) {
      previousClickHandler(e);
    }

    // Add a new snowflake where the user clicked
    const snowflake = document.createElement("div");
    snowflake.className = "snowflake";
    snowflake.innerHTML = "&#10052;";

    const newSnowflake = {
      el: snowflake,
      x: e.clientX,
      y: 0,
      size: Math.random() * 20 + 10,
      speed: Math.random() * 3 + 1,
      color: getRandomColor(),
    };

    snowflakes.push(newSnowflake);
    document.body.appendChild(snowflake);
  };
};

// Add a click event handler to the page to start the animation
handlePageClick();

// Start the animation loop
animateSnowflakes();

// Inject CSS rules to style the snowflake element
const css = `
  .snowflake {
    position: fixed;
    user-select: none;
  }
`;

const injectSnowflakeStyles = (css) => {
  const style = document.createElement("style");
  style.type = "text/css";

  try {
    style.appendChild(document.createTextNode(css));
  } catch (e) {
    style.styleSheet.cssText = css;
  }

  document.head.appendChild(style);
};

injectSnowflakeStyles(css);

// Generate a random RGB color string using an arrow function
const getRandomColor = () => {
  return `rgb(${~~(255 * Math.random())},${~~(255 * Math.random())},${~~(255 * Math.random())})`;
};
