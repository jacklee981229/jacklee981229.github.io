var scripts = [
    // '/javascript/fireworks.js',
    '/javascript/click-effects/cgpt-snowflake.js',
    // '/javascript/click-effects/cgpt-confetti.js',
    '/javascript/click-effects/cgpt-firework.js',
    '/javascript/click-effects/cgpt-heart.js'
];

//   var script1 = document.createElement('script');
//   script1.src = "https://fastly.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/autoload.js";
//   document.head.appendChild(script1);


// A firework clicking effect
{/* <canvas class="fireworks" style="position: fixed;left: 0;top: 0;z-index: 1; pointer-events: none;" ></canvas> 
<script type="text/javascript" src="//cdn.bootcss.com/animejs/2.2.0/anime.min.js"></script> 
<script type="text/javascript" src="/javascript/fireworks.js"></script> */}



var index = Math.floor(Math.random() * scripts.length);
// if (index == 0) {
//     var canvas = document.createElement('canvas');
//     canvas.className = "fireworks";
//     canvas.style = "position: fixed;left: 0;top: 0;z-index: 1; pointer-events: none;";
//     document.body.appendChild(canvas);
//     var script2 = document.createElement('script');
//     script2.type = "text/javascript";
//     script2.src = "//cdn.bootcss.com/animejs/2.2.0/anime.min.js";
//     document.body.appendChild(script2);
//     var script3 = document.createElement('script');
//     script3.type = "text/javascript";
//     script3.src = "/javascript/fireworks.js";
//     document.body.appendChild(script3);
// }
// else {
    var script = document.createElement('script');
    script.src = scripts[index];
    document.head.appendChild(script);
// }