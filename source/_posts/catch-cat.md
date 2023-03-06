---
title: Play Catch the Cat!
date: 2023-03-02 23:07:33
tags: [game]
hidden: true
---
<div style="text-align: center; width: 100%; border: 1px solid black;" >
    <script src="/javascript/catch-cat/phaser.min.js"></script>
    <script src="/javascript/catch-cat/catch-the-cat.js"></script>
    <div id="catch-the-cat"></div>
    <script>
      window.game = new CatchTheCatGame({
        w: 11,
        h: 11,
        r: 20,
        backgroundColor: 0xffffff,
        parent: 'catch-the-cat',
        statusBarAlign: 'center',
        credit: 'github.com/ganlvtech'
      });
    </script>
</div>

##### Project From [here](https://github.com/ganlvtech/phaser-catch-the-cat)