---
title: "Play Catch the Cat!"
description: "Trap the cat before it gets away."
date: 2023-03-02T23:07:33+08:00
topic: games
tags: ["game"]
hidden: true
---

<div style="text-align: center; width: 100%; overflow-x: auto;">
    <script src="/games/catch-the-cat/phaser.min.js"></script>
    <script src="/games/catch-the-cat/catch-the-cat.js"></script>
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
