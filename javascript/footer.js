function generateScriptAsync() {
    const script = document.createElement('script');
    script.setAttribute('src', '//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js',);
    script.setAttribute('async', '');
    document.body.appendChild(script);
  }

function generateVisitorsCount() {
    generateScriptAsync();
    const span = document.createElement('span');
    
    const pageVisitsSpan = document.createElement('span');
    pageVisitsSpan.id = 'busuanzi_value_page_pv';
    pageVisitsSpan.style.color = 'rgb(13, 109, 252)';
    pageVisitsSpan.style.fontWeight = 'bold';
    
    const totalVisitsSpan = document.createElement('span');
    totalVisitsSpan.id = 'busuanzi_value_site_pv';
    totalVisitsSpan.style.color = 'rgb(13, 109, 252)';
    totalVisitsSpan.style.fontWeight = 'bold';
    
    const totalVisitorsSpan = document.createElement('span');
    totalVisitorsSpan.id = 'busuanzi_value_site_uv';
    totalVisitorsSpan.style.color = 'rgb(13, 109, 252)';
    totalVisitorsSpan.style.fontWeight = 'bold';
    
    const textNode1 = document.createTextNode('This page was visited ');
    const textNode2 = document.createTextNode(' times | 👀Total visits: ');
    const textNode3 = document.createTextNode(' | 🥷Total visitors: ');
    
    span.appendChild(textNode1);
    span.appendChild(pageVisitsSpan);
    span.appendChild(textNode2);
    span.appendChild(totalVisitsSpan);
    span.appendChild(textNode3);
    span.appendChild(totalVisitorsSpan);
    
    span.id = "visitor_span";
    document.querySelector('div.footer-inner').appendChild(span);
  }

// Create the runtime_span element
var runtime_span = document.createElement("span");
runtime_span.id = "runtime_span";
document.querySelector('div.footer-inner').appendChild(runtime_span);

// Define the function to update the runtime
function update_runtime() {
    var X = new Date("2/23/2023 14:20:07");
    var Y = new Date();
    var T = (Y.getTime() - X.getTime());
    var M = 24 * 60 * 60 * 1000;
    var a = T / M;
    var A = Math.floor(a);
    var b = (a - A) * 24;
    var B = Math.floor(b);
    var c = (b - B) * 60;
    var C = Math.floor((b - B) * 60);
    var D = Math.floor((c - C) * 60);
    runtime_span.innerHTML = "⏱️This site has been running for " + A + " days, " + B + " hours, " + C + " minutes and " + D + " seconds";
}

// Update the runtime every second
generateVisitorsCount();
setInterval(update_runtime, 1000);
