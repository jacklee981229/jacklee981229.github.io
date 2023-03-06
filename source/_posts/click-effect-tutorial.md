---
title: click-effect-tutorial
description: Tutorial of adding click effects to your Hexo.
date: 2023-03-03 19:07:04
tags:
id: blog_5
---

You can add some clicking effects in your Hexo project.

There are a lots of tutorial that ask you to add files into your `themes\layout\*.ejs` files, but I suppose you will only find a .`gitkeep` file in the latest version of Hexo.

###### NOTE: Do note that I am using Hexo + [Next](https://theme-next.js.org/) theme. So if you are not using Next theme, you might need to make some changes accordingly.

#### Steps
1. prepare a `javascript` script that will add effect when mouse clicking. In this tutorial I will use a `heart.js` file.
    1. [heart.js](2023/03/03/heart-js/)
2. Store your `heart.js` file somewhere under `source` directory.
    1. in this case we will create a `javascript` folder under `source` and put the `heart.js` inside.
    2. full path will be `/javascript/heart.js`.
2. create a `_data` folder under your `source`. Visit [link](https://hexo.io/docs/data-files.html) to understand how it works.
3. create a `head.njk` file.
4. from `_config.next.yml` file, find the `custom_file_path:` and uncomment the head section like this:

```yml
custom_file_path:
   head: source/_data/head.njk
```

5. In `head.njk`, we will insert code below:

```html
<script type="text/javascript" src="/javascript/heart.js"></script>
```

6. That's all! Enjoy!