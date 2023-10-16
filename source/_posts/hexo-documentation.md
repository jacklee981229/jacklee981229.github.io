---
title: Hexo Documentation
tags:
  - hexo
  - next
description: >-
  This article shows on how to create Hexo and errors that you might encounter
  when using Hexo.
date: 2023-03-02 09:08:51
id: 1
---

# How to Hexo?

## Official Documentation

- [Hexo](https://hexo.io/docs/)
- [Next](https://theme-next.js.org/docs/) - a theme from Hexo, the one I am using

## Some good-looking themes

- [Next](https://theme-next.js.org/)
- [Redefine](https://redefine.ohevan.com/)
- [Fluid](https://hexo.fluid-dev.com/)
- [Cactus](https://probberechts.github.io/hexo-theme-cactus/)
- [Stellar](https://xaoxuu.com/wiki/stellar/)
- [Butterfly](https://github.com/jerryc127/hexo-theme-butterfly)

## Some interesting Blog

- [Layne's Blog](https://wxler.github.io/)
- [酷小呵](https://www.kuhehe.top/)

## Multiple workspace/device

- [JIAQI XIAO](https://jqxiao.tech/2020/07/17/Transfer-Hexo-Blog-to-New-Device/)
- [Stack Overflow Ans](https://stackoverflow.com/a/46219728)
- [MALEKBENZ](https://malekbenz.com/blog/2016/09/10/Create-Host-Blog-for-free-with-Hexo-Github)

## Pinned article on Top

- [hexo-generator-index](https://github.com/hexojs/hexo-generator-index) --> refers to [This](https://theme-next.js.org/docs/advanced-settings/front-matter.html?highlight=sticky+pin#Settings-amp-Their-Default-Values)
- [hexo-generator-index-pin-top](https://github.com/netcan/hexo-generator-index-pin-top)

## Full Tutorial

- [Hexo + Github Page](https://segmentfault.com/a/1190000017986794)

## Add Mini Game to Hexo

- [Lei Mao](https://leimao.github.io/blog/Hexo-Blog-Add-JavaScript/)

# Possible to encounter: Errors and solutions

- Error EPERM: Error when copying files from extend dirs:

```bash
←[32mINFO ←[39m Copying files from extend dirs...
←[41mFATAL←[49m Something's wrong. Maybe you can find the solution here: ←[4mhttps://hexo.io/docs/troubleshooting.html←[24m
←[33mError: EPERM: operation not permitted, copyfile 'C:\repos\jacklee981229.github.io\.git\objects\e6\9de29bb2d1d6434b8b29ae775ad8c2e48c5391' -> 'C:\repos\jacklee981229.github.io\.deploy_git\.git\objects\e6\9de29bb2d1d6434b8b29ae775ad8c2e48c5391'←[39m
```

**Solution** : try delete ".git" folder!

- Error ENOTEMPTY: Error when clearing ".deploy_git" folder

```bash
INFO  Deploying: git
INFO  Clearing .deploy_git folder...
FATAL Something's wrong. Maybe you can find the solution here: https://hexo.io/docs/troubleshooting.html
Error: ENOTEMPTY: directory not empty, rmdir 'C:\repos\jacklee981229.github.io\.deploy_git\themes'
```

**Solution** : try delete ".deploy_git" folder!

### NOTE: All the mentioned errors seems to be occur when you try to upload hexo blog into github but in new branch. I worked on this by refering to [this article](https://jqxiao.tech/2020/07/17/Transfer-Hexo-Blog-to-New-Device/), but seems to be missing out some of the steps.
