---
title: How to inject scripts in Hexo?
tags: [blog,hexo,next,script,javascript]
description: This is a tutorial of how injects works in Hexo - Next.
date: 2023-03-05 21:22:54
---

{% centerquote %}Hexo reads scripts that are stored under a `scripts` folder in your root folder.{% endcenterquote %}
</br>

##### The Reason why I adding this tutorial:

> <a name="note1"></a>Note: 
> I am not sure, but seems like njk files from `source/_data/` only support first `<script>` tag.
> Ofcourse you can have only one `<script>` tag in the njk file, and from the just use one script to run multiple scripts. But for me it is not an elegant way.

---

##### Prerequisite:

> `hexo-theme-next` installed.

##### Steps

0. [`Next`](https://theme-next.js.org/)  allows additional [injects](https://theme-next.js.org/docs/advanced-settings/injects) beside those preset in `custom_file_path` from next config file. Read [how custom_file_path works](https://theme-next.js.org/docs/advanced-settings/custom-files.html).

1. Create a `scripts` folder in your root folder.

2. Add a `any_name.js` script file. In this example I will named it `inject.js`.

3. Add following codes into `inject.js`.

```js inject.cs
"use strict";

hexo.extend.filter.register('theme_inject', function(injects) {
    // Name path etc. can be modified at will, in order to facilitate the following are based on the definition here
    injects.head.file('click_effect', 'source/_data/click_effect.njk', {}, {cache: true});
    // the `head` from `injects.head` == the <head> tag in html
  });
```

  - Do note that I am using `hexo-theme-next` in my project. So the following code only works for next theme. If you are working with other theme, you should be able to directly inject script into hexo.

4. Add a new `.njk` file under `source/_data/` folder. If you don't have `_data` folder, just create one.

```js click_effect.njk
<script type="text/javascript" src="any_script.js"></script>
```