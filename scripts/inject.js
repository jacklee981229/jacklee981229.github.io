"use strict";

// hexo.extend.filter.register('theme_inject', function(injects) {
//     // Name path etc. can be modified at will, in order to facilitate the following are based on the definition here
//     injects.head.file('click_effect', 'source/_data/click_effect.njk', {}, {cache: true});
//   });

hexo.extend.filter.register('theme_inject', function(injects) {
    // Name path etc. can be modified at will, in order to facilitate the following are based on the definition here
    injects.bodyEnd.file('custom', 'source/_data/custom.njk', {}, {cache: true});
  });  