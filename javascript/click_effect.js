// One way to make this works is to include under `node_modules/hexo-theme-next/scripts/`
// but it is not recommended to add file into `node_modules`.

hexo.extend.filter.register('theme_inject', function(injects) {
    // Name path etc. can be modified at will, in order to facilitate the following are based on the definition here
    injects.head.file('click_effect', 'source/_data/click_effect.njk', {}, {cache: true});
  });