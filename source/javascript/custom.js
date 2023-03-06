// Load custom script
var script = document.createElement('script');
script.src = '/javascript/choose-effect.js';
document.head.appendChild(script);

var script1 = document.createElement('script');
script1.src = '/javascript/footer.js';
var innerFoot = document.querySelector('div.footer-inner');
innerFoot.appendChild(script1);