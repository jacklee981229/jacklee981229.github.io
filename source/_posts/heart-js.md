---
title: Sample Heart.js script
tags:
  - script
  - javascript
description: This is used in `Click-Effect-Tutorial` post
date: 2023-03-03 19:06:08
id: blog_4
---

```js Heart.js
// Declare the hearts array using const
const hearts = [];

// Animate the falling hearts using an arrow function
const animateHearts = () => {
  for (let i = 0; i < hearts.length; i++) {
    const heart = hearts[i];
    
    // Remove hearts that have faded out
    if (heart.alpha <= 0) {
      heart.el.remove();
      hearts.splice(i, 1);
      i--;
    }
    // Animate existing hearts
    else {
      heart.y--;
      heart.scale += 0.004;
      heart.alpha -= 0.013;
      heart.el.style.cssText = `left:${heart.x}px;top:${heart.y}px;opacity:${heart.alpha};transform:scale(${heart.scale},${heart.scale}) rotate(45deg);background:${heart.color};z-index:99999`;
    }
  }
  
  requestAnimationFrame(animateHearts);
};

// Handle click events on the page using an arrow function
const handlePageClick = () => {
  const previousClickHandler = window.onclick;

  window.onclick = (e) => {
    // Call any previous click handler
    if (previousClickHandler) {
      previousClickHandler(e);
    }
    
    // Add a new heart where the user clicked
    const heart = document.createElement("div");
    heart.className = "heart";
    
    const newHeart = {
      el: heart,
      x: e.clientX - 5,
      y: e.clientY - 5,
      scale: 1,
      alpha: 1,
      color: getRandomColor(),
    };
    
    hearts.push(newHeart);
    document.body.appendChild(heart);
  };
};

// Add a click event handler to the page to start the animation
handlePageClick();

// Start the animation loop
animateHearts();

// Inject CSS rules to style the heart element
const css = `
  .heart {
    width: 10px;
    height: 10px;
    position: fixed;
    background: #f00;
    transform: rotate(45deg);
    -webkit-transform: rotate(45deg);
    -moz-transform: rotate(45deg);
  }
  .heart:after,
  .heart:before {
    content: '';
    width: inherit;
    height: inherit;
    background: inherit;
    border-radius: 50%;
    -webkit-border-radius: 500%;
    -moz-border-radius: 50%;
    position: fixed;
  }
  .heart:after {
    top: -5px;
  }
  .heart:before {
    left: -5px;
  }
`;

const injectHeartStyles = (css) => {
  const style = document.createElement("style");
  style.type = "text/css";
  
  try {
    style.appendChild(document.createTextNode(css));
  } catch (e) {
    style.styleSheet.cssText = css;
  }
  
  document.head.appendChild(style);
};

injectHeartStyles(css);

// Generate a random RGB color string using an arrow function
const getRandomColor = () => {
  return `rgb(${~~(255 * Math.random())},${~~(255 * Math.random())},${~~(255 * Math.random())})`;
};

```