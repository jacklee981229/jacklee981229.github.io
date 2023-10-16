---
title: 'Theme Modification 1: Loading Screen'
copyright: false
date: 2023-03-13 20:51:35
tags:
id: 7
---


{% note info simple %}
Prerequisite: Hexo and Butterfly theme
{% endnote %}

# Modified `fullpage-loading.pug`

under `themes/butterfly/includes/loading`.

```pug fullpage-loading.pug
#loading-box
  .loading-left-bg
  .loading-right-bg
  .spinner-box
    .configure-border-1
      .configure-core
    .configure-border-2
      .configure-core
    .loading-word= _p('loading')
```

Replace all to this:

```pug fullpage-loading.pug
if theme.preloader.enable
  case theme.preloader.load_style    
    when 'gear'
      include ./load_style/gear.pug
    when 'ironheart'
      include ./load_style/ironheart.pug
    when 'scarecrow'
      include ./load_style/scarecrow.pug
    when 'triangles'
      include ./load_style/triangles.pug
    when 'wizard'
      include ./load_style/wizard.pug
    default
      include ./load_style/default.pug
```

> Do note that all files mentioned in `fullpage-loading.pug` must be present. If you only include `gear.pug` and `default.pug`, it should look like below:

```pug fullpage-loading.pug
if theme.preloader.enable
  case theme.preloader.load_style    
    when 'gear'
      include ./load_style/gear.pug
    default
      include ./load_style/default.pug
```

# Custom pug files

first create a `load_style` folder under same directory: `themes/butterfly/includes/loading`.
put all files created below into `load_style`.

### `default.pug`

```pug
#loading-box
  .loading-left-bg
  .loading-right-bg
  .spinner-box
    .configure-border-1
      .configure-core
    .configure-border-2
      .configure-core
    .loading-word= _p('loading')
```

### `gear.pug`

```pug
#loading-box
  .gear-loader
    .gear-loader_overlay
    .gear-loader_cogs
      .gear-loader_cogs__top
        .gear-top_part
        .gear-top_part
        .gear-top_part
        .gear-top_hole
      .gear-loader_cogs__left
        .gear-left_part
        .gear-left_part
        .gear-left_part
        .gear-left_hole
      .gear-loader_cogs__bottom
        .gear-bottom_part
        .gear-bottom_part
        .gear-bottom_part
        .gear-bottom_hole
```

### `ironheart.pug`

```pug
#loading-box
  .loading-left-bg
  .loading-right-bg
  .iron-container.iron-circle
    .iron-box1.iron-circle.iron-center
    .iron-box2.iron-circle.iron-center
    .iron-box3.iron-circle.iron-center
    .iron-box4.iron-circle.iron-center
    .iron-box5.iron-circle.iron-center
    .iron-box6.iron-circle
      .iron-coil(style='--i: 0')
      .iron-coil(style='--i: 1')
      .iron-coil(style='--i: 2')
      .iron-coil(style='--i: 3')
      .iron-coil(style='--i: 4')
      .iron-coil(style='--i: 5')
      .iron-coil(style='--i: 6')
      .iron-coil(style='--i: 7')
```

### `scarecrow.pug`

```pug
#loading-box
  .loading-left-bg
  .loading-right-bg
  .scarecrow
    .scarecrow__hat
      .scarecrow__ribbon
    .scarecrow__head
      .scarecrow__eye
      .scarecrow__eye
      .scarecrow__mouth
      .scarecrow__pipe
    .scarecrow__body
      .scarecrow__glove.scarecrow__glove--l
      .scarecrow__sleeve.scarecrow__sleeve--l
      .scarecrow__bow
      .scarecrow__shirt
      .scarecrow__coat
      .scarecrow__waistcoat
      .scarecrow__sleeve.scarecrow__sleeve--r
      .scarecrow__glove.scarecrow__glove--r
      .scarecrow__coattails
      .scarecrow__pants
    .scarecrow__arms
    .scarecrow__leg   
```

### `triangles.pug`

```pug
#loading-box
  .triangles-wrap
    .triangles-eiz
    .triangles-seiz
    .triangles-sei
    .triangles-fei
    .triangles-feir
    .triangles-trei
    .triangles-dvai
    .triangles-ein
    .triangles-zero
```

### `wizard.pug`

```pug
#loading-box
  .loading-left-bg
  .loading-right-bg
  .wizard-scene
    .wizard-objects
      .wizard-square
      .wizard-circle
      .wizard-triangle
    .wizard
      .wizard-body
      .wizard-right-arm
        .wizard-right-hand
      .wizard-left-arm
        .wizard-left-hand
      .wizard-head
        .wizard-beard
        .wizard-face
          .wizard-adds
        .wizard-hat
          .wizard-hat-of-the-hat
          .wizard-four-point-star.--first
          .wizard-four-point-star.--second
          .wizard-four-point-star.--third
```

# Modified `loading.styl`

file under `themes/butterfly/css/_layout`.

replace to content below:

```styl loading.styl
if hexo-config('preloader.enable')
  if hexo-config('preloader.load_style') == 'gear'
    @import './_load_style/gear'
  else if hexo-config('preloader.load_style') == 'ironheart'
    @import './_load_style/ironheart'
  else if hexo-config('preloader.load_style') == 'scarecrow'
    @import './_load_style/scarecrow'
  else if hexo-config('preloader.load_style') == 'triangles'
    @import './_load_style/triangles'
  else if hexo-config('preloader.load_style') == 'wizard'
    @import './_load_style/wizard'
  else
    @import './_load_style/default'
```

# Create `_load_style` folder

create `_load_style` folder under `/themes/butterfly/source/css`.
create `.styl` files under `_load_style` folder, these files are paired with created `.pug` files.

## `default.styl`

```styl default.styl
if hexo-config('preloader.enable') && hexo-config('preloader.source') == 1
  .loading-bg
    position: fixed
    z-index: 1000
    width: 50%
    height: 100%
    background-color: var(--preloader-bg)

  #loading-box
    .loading-left-bg
      @extend .loading-bg

    .loading-right-bg
      @extend .loading-bg
      right: 0

    .spinner-box
      position: fixed
      z-index: 1001
      display: flex
      justify-content: center
      align-items: center
      width: 100%
      height: 100vh

      .configure-border-1
        position: absolute
        padding: 3px
        width: 115px
        height: 115px
        background: #ffab91
        animation: configure-clockwise 3s ease-in-out 0s infinite alternate

      .configure-border-2
        left: -115px
        padding: 3px
        width: 115px
        height: 115px
        background: rgb(63, 249, 220)
        transform: rotate(45deg)
        animation: configure-xclockwise 3s ease-in-out 0s infinite alternate

      .loading-word
        position: absolute
        color: var(--preloader-color)
        font-size: 16px

      .configure-core
        width: 100%
        height: 100%
        background-color: var(--preloader-bg)

    &.loaded
      .loading-left-bg
        transition: all .5s
        transform: translate(-100%, 0)

      .loading-right-bg
        transition: all .5s
        transform: translate(100%, 0)

      .spinner-box
        display: none

  @keyframes configure-clockwise
    0%
      transform: rotate(0)

    25%
      transform: rotate(90deg)

    50%
      transform: rotate(180deg)

    75%
      transform: rotate(270deg)

    100%
      transform: rotate(360deg)

  @keyframes configure-xclockwise
    0%
      transform: rotate(45deg)

    25%
      transform: rotate(-45deg)

    50%
      transform: rotate(-135deg)

    75%
      transform: rotate(-225deg)

    100%
      transform: rotate(-315deg)

```

## `gear.styl`

```styl gear.styl
#loading-box
  position fixed
  z-index 1000
  width 100vw
  height 100vh
  overflow hidden
  text-align center
  &.loaded
    z-index -1000
    .gear-loader
      display none
  .gear-loader
    height 100%
    position relative
    margin auto
    width 400px
  .gear-loader_overlay
    width 150px
    height 150px
    background transparent
    box-shadow 0px 0px 0px 1000px rgba(255, 255, 255, 0.67), 0px 0px 19px 0px rgba(0, 0, 0, 0.16) inset
    border-radius 100%
    z-index -1
    position absolute
    left 0
    right 0
    top 0
    bottom 0
    margin auto
  .gear-loader_cogs
    z-index -2
    width 100px
    height 100px
    top -120px !important
    position absolute
    left 0
    right 0
    top 0
    bottom 0
    margin auto
  .gear-loader_cogs__top
    position relative
    width 100px
    height 100px
    transform-origin 50px 50px
    -webkit-animation rotate 10s infinite linear
    animation rotate 10s infinite linear
    div
      &:nth-of-type(1)
        transform rotate(30deg)
      &:nth-of-type(2)
        transform rotate(60deg)
      &:nth-of-type(3)
        transform rotate(90deg)
      &.gear-top_part
        width 100px
        border-radius 10px
        position absolute
        height 100px
        background #f98db9
      &.gear-top_hole
        width 50px
        height 50px
        border-radius 100%
        background white
        position absolute
        position absolute
        left 0
        right 0
        top 0
        bottom 0
        margin auto
  .gear-loader_cogs__left
    position relative
    width 80px
    transform rotate(16deg)
    top 28px
    transform-origin 40px 40px
    animation rotate_left 10s 0.1s infinite reverse linear
    left -24px
    height 80px
    div
      &:nth-of-type(1)
        transform rotate(30deg)
      &:nth-of-type(2)
        transform rotate(60deg)
      &:nth-of-type(3)
        transform rotate(90deg)
      &.gear-left_part
        width 80px
        border-radius 6px
        position absolute
        height 80px
        background #97ddff
      &.gear-left_hole
        width 40px
        height 40px
        border-radius 100%
        background white
        position absolute
        position absolute
        left 0
        right 0
        top 0
        bottom 0
        margin auto
  .gear-loader_cogs__bottom
    position relative
    width 60px
    top -65px
    transform-origin 30px 30px
    -webkit-animation rotate_left 10.2s 0.4s infinite linear
    animation rotate_left 10.2s 0.4s infinite linear
    transform rotate(4deg)
    left 79px
    height 60px
    div
      &:nth-of-type(1)
        transform rotate(30deg)
      &:nth-of-type(2)
        transform rotate(60deg)
      &:nth-of-type(3)
        transform rotate(90deg)
      &.gear-bottom_part
        width 60px
        border-radius 5px
        position absolute
        height 60px
        background #ffcd66
      &.gear-bottom_hole
        width 30px
        height 30px
        border-radius 100%
        background white
        position absolute
        position absolute
        left 0
        right 0
        top 0
        bottom 0
        margin auto



/* Animations */
@-webkit-keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
@-webkit-keyframes rotate_left {
  from {
    transform: rotate(16deg);
  }
  to {
    transform: rotate(376deg);
  }
}
@keyframes rotate_left {
  from {
    transform: rotate(16deg);
  }
  to {
    transform: rotate(376deg);
  }
}
@-webkit-keyframes rotate_right {
  from {
    transform: rotate(4deg);
  }
  to {
    transform: rotate(364deg);
  }
}
@keyframes rotate_right {
  from {
    transform: rotate(4deg);
  }
  to {
    transform: rotate(364deg);
  }
}
```

## `ironheart.styl`

```styl ironheart.styl
.loading-bg
  position fixed
  z-index 1000
  width 50%
  height 100%
  background var(--preloader-bg)
#loading-box
  .loading-left-bg
    @extend .loading-bg
    left 0
  .loading-right-bg
    @extend .loading-bg
    right 0
  &.loaded
    z-index -1000
    .loading-left-bg
      transition all 1.0s
      transform translate(-100%, 0)
    .loading-right-bg
      transition all 1.0s
      transform translate(100%, 0)
#loading-box
  position fixed
  z-index 1000
  display -webkit-box
  display flex
  -webkit-box-align center
  align-items center
  -webkit-box-pack center
  justify-content center
  -webkit-box-orient vertical
  -webkit-box-direction normal
  flex-direction column
  flex-wrap wrap
  width 100vw
  height 100vh
  overflow hidden

  &.loaded
    .iron-container
      display none

  .iron-circle
    border-radius 50%

  .iron-center
    position absolute
    top 50%
    left 50%
    transform translate(-50%, -50%)

  .iron-container
    z-index 1001
    position relative
    width 300px
    height 300px
    border 1px solid rgb(18, 20, 20)
    background-color #384c50
    box-shadow 0 0 32px 8px rgb(18, 20, 20), 0 0 4px 1px rgb(18, 20, 20) inset
    .iron-box1
      width 238px
      height 238px
      background-color rgb(22, 26, 27)
      box-shadow 0 0 4px 1px #52fefe
    .iron-box2
      width 220px
      height 220px
      background-color #fff
      box-shadow 0 0 5px 1px #52fefe, 0 0 5px 4px #52fefe inset
    .iron-box3
      width 180px
      height 180px
      background-color #073c4b
      box-shadow 0 0 5px 4px #52fefe, 0 0 6px 2px #52fefe inset
    .iron-box4
      width 120px
      height 120px
      border 1px solid #52fefe
      background-color #fff
      box-shadow 0 0 2px 1px #52fefe, 0 0 10px 5px #52fefe inset
    .iron-box5
      width 70px
      height 70px
      border 5px solid #1b4e5f
      box-shadow 0 0 7px 5px #52fefe, 0 0 10px 10px #52fefe inset
    .iron-box6
      position relative
      width 100%
      height 100%
      animation ironrotate 3s linear infinite
      .iron-coil
        position absolute
        width 30px
        height 20px
        top calc(50% - 110px)
        left calc(50% - 15px)
        background-color #073c4b
        box-shadow 0 0 5px #52fefe inset
        transform rotate(calc(var(--i) * 45deg))
        transform-origin center 110px
@keyframes ironrotate
	0%
		transform rotate(0)
	100%
		transform rotate(360deg)

```

## `scarecrow.styl`

```styl scarecrow.styl
.loading-bg
  position fixed
  z-index 1000
  width 50%
  height 100%
  background var(--preloader-bg)
#loading-box
  .loading-left-bg
    @extend .loading-bg
    left 0
  .loading-right-bg
    @extend .loading-bg
    right 0
  &.loaded
    z-index -1000
    .loading-left-bg
      transition all 1.0s
      transform translate(-100%, 0)
    .loading-right-bg
      transition all 1.0s
      transform translate(100%, 0)

#loading-box
  position fixed
  z-index 1000
  display -webkit-box
  display flex
  -webkit-box-align center
  align-items center
  -webkit-box-pack center
  justify-content center
  -webkit-box-orient vertical
  -webkit-box-direction normal
  flex-direction column
  flex-wrap wrap
  width 100vw
  height 100vh
  overflow hidden
  &.loaded
    .scarecrow
      display none
  .scarecrow
    z-index 1001
    position relative
    animation hop 0.2s ease-in alternate infinite

  .scarecrow__hat
    position relative
    border-top-left-radius 5px
    border-top-right-radius 5px
    border-top 45px solid #515559
    border-left 1px solid transparent
    border-right 1px solid transparent
    width 55px
    margin 0 auto -3px
    z-index 1
    &:before
      content ""
      position absolute
      top -87px
      right -23px
      background-color #515559
      width 9px
      height 55px
      border-radius 100%
      transform rotate(50deg)
    &:after
      content ""
      position absolute
      top 12px
      left -15px
      background-color #515559
      width 85px
      height 10px
      border-radius 40% 40% 70% 70%

  .scarecrow__ribbon
    width 55px
    height 12px
    background-color #d996b5
    margin 0 auto

  .scarecrow__head
    position relative
    background-color #f2f2f2
    width 70px
    height 55px
    margin 0 auto
    border-radius 50%
    display flex
    justify-content space-around
    flex-flow row wrap

  .scarecrow__eye
    width 6px
    height 6px
    background-color #000
    border-radius 50%
    margin 20px 5px 0

  .scarecrow__mouth
    width 45px
    height 15px
    background-color #fff
    border-radius 50%

  .scarecrow__pipe
    position absolute
    top 40px
    left 60px
    width 40px
    height 2px
    background-color #8c8070
    &:before
      content ""
      position absolute
      width 9px
      height 17px
      background-color #8c8070
      border-radius 3px
      left 40px
      top -7px

  .scarecrow__body
    position relative
    width 250px
    z-index 1

  .scarecrow__coat
    position absolute
    top 15px
    left 0
    right 0
    margin-left auto
    margin-right auto
    border-top 100px solid #515559
    border-left 5px solid transparent
    border-right 5px solid transparent
    width 75px

  .scarecrow__bow
    position absolute
    top 20px
    left 0
    right 0
    margin-left auto
    margin-right auto
    background-color #3a485d
    width 10px
    height 10px
    z-index 3
    border-radius 2px
    &:before
      content ""
      position absolute
      top -10px
      left -25px
      width 0
      height 10px
      border-top 10px solid transparent
      border-left 25px solid #5a6b8c
      border-bottom 10px solid transparent
      border-radius 8px
    &:after
      content ""
      position absolute
      top -10px
      right -25px
      width 0
      height 10px
      border-top 10px solid transparent
      border-right 25px solid #5a6b8c
      border-bottom 10px solid transparent
      border-radius 8px

  .scarecrow__shirt
    position absolute
    top 8px
    left 0
    right 0
    margin-left auto
    margin-right auto
    width 30px
    height 35px
    z-index 2
    &:before
      content ""
      position absolute
      top 0
      left -5px
      height 100%
      width 70%
      background-color #dbb2c2
      transform skew(1deg, 35deg)
      border-bottom-left-radius 90px
      border-top-left-radius 15px
      border-bottom-right-radius 15px
      border-top-right-radius 10px
    &:after
      content ""
      position absolute
      top 0
      right -5px
      height 100%
      width 70%
      background-color #dbb2c2
      transform skew(-1deg, -35deg)
      border-top-right-radius 15px
      border-bottom-right-radius 90px
      border-bottom-left-radius 15px
      border-top-left-radius 10px

  .scarecrow__waistcoat
    position absolute
    top 15px
    left -1px
    right 0
    margin-left auto
    margin-right auto
    width 35px
    height 50px
    &:before
      content ""
      position absolute
      top 0
      left -4px
      height 100%
      width 65%
      background-color #83a6bc
      transform skew(0deg, 40deg)
      border-bottom-left-radius 90px
      border-top-left-radius 90px
      border-bottom-right-radius 15px
    &:after
      content ""
      position absolute
      top 0
      right -5px
      height 100%
      width 65%
      background-color #83a6bc
      transform skew(0deg, -40deg)
      border-top-right-radius 90px
      border-bottom-right-radius 90px
      border-bottom-left-radius 15px

  .scarecrow__coattails
    position absolute
    top 105px
    left 0
    right 0
    margin-left auto
    margin-right auto
    width 75px
    height 120px
    z-index 1
    &:before
      content ""
      position absolute
      top 0
      left 8px
      height 100%
      width 60%
      background-color #515559
      transform-origin top
      transform skew(-25deg, 30deg) rotate(0deg)
      border-bottom-left-radius 50px
      border-bottom-right-radius 5px
      animation coattails-left 0.2s ease-in alternate infinite
    &:after
      content ""
      position absolute
      top 0
      right 8px
      height 100%
      width 60%
      background-color #515559
      transform-origin top
      transform skew(25deg, -30deg) rotate(0deg)
      border-bottom-right-radius 50px
      border-bottom-left-radius 5px
      animation coattails-right 0.2s ease-in alternate infinite

  .scarecrow__pants
    position absolute
    top 115px
    left 0
    right 0
    margin-left auto
    margin-right auto
    width 50px
    height 150px
    &:before
      content ""
      position absolute
      top 0
      left -8px
      height 100%
      width 60%
      background-color #393c3e
      transform rotate(0deg)
      transform-origin top
      animation pants 0.5s linear alternate infinite
    &:after
      content ""
      position absolute
      top 0
      right -8px
      height 100%
      width 60%
      background-color #393c3e
      transform rotate(0deg)
      transform-origin top
      animation pants 0.3s linear alternate infinite

  .scarecrow__sleeve
    position absolute
    top 15px
    background-color #515559
    width 80px
    height 25px

  .scarecrow__sleeve--l
    left 10px
    &:before
      content ""
      position absolute
      top -3px
      left -22px
      width 0
      height 25px
      border-top 3px solid transparent
      border-left 25px solid #515559
      border-bottom 3px solid transparent
      border-radius 3px

  .scarecrow__sleeve--r
    right 10px
    &:before
      content ""
      position absolute
      top -3px
      right -22px
      width 0
      height 25px
      border-top 3px solid transparent
      border-right 25px solid #515559
      border-bottom 3px solid transparent
      border-radius 3px

  .scarecrow__glove
    position absolute
    top 12px
    width 0px
    height 12px
    &:before
      content ""
      position absolute
      top -7px
      border-radius 100%
      background-color #f2f2f2
      width 35px
      height 15px

  .scarecrow__glove--l
    border-top 3px solid transparent
    border-right 20px solid #f2f2f2
    border-bottom 3px solid transparent
    left -50px
    &:before
      transform-origin right
      left -30px
      transform rotate(0deg)
      animation glove-l 0.2s linear alternate infinite

  .scarecrow__glove--r
    border-top 3px solid transparent
    border-left 20px solid #f2f2f2
    border-bottom 3px solid transparent
    right -50px
    &:before
      transform-origin left
      right -30px
      transform rotate(0deg)
      animation glove-r 0.2s linear alternate infinite

  .scarecrow__arms
    position absolute
    left 50%
    transform translate(-50%, -50%)
    background-color #8c8070
    width 350px
    height 8px
    border-radius 5px
    margin 20px auto

  .scarecrow__leg
    position relative
    background-color #8c8070
    width 8px
    height 380px
    border-bottom-left-radius 5px
    border-bottom-right-radius 5px
    margin 0 auto

@keyframes hop
  0%
    transform translateY(-10px)
  100%
    transform translateY(10px)

@keyframes coattails-left
  0%
    transform skew(-25deg, 30deg) rotate(-3deg)
  100%
    transform skew(-25deg, 30deg) rotate(3deg)

@keyframes coattails-right
  0%
    transform skew(25deg, -30deg) rotate(3deg)
  100%
    transform skew(25deg, -30deg) rotate(-3deg)

@keyframes pants
  0%
    transform rotate(3deg)
  100%
    transform rotate(-3deg)

@keyframes glove-l
  0%
    transform rotate(-50deg)
  100%
    transform rotate(-30deg)

@keyframes glove-r
  0%
    transform rotate(50deg)
  100%
    transform rotate(30deg)


```

## `triangles.styl`

```styl triangles.styl
#loading-box
  position fixed
  z-index 1000
  width 100vw
  height 100vh
  overflow hidden
  &.loaded
    z-index -1000
    .triangles-wrap
      display none

.triangles-wrap
  position absolute
  top 50%
  left 50%
  transform translate(-50%,-66.6666666666666666%)
  -ms-transform translate(-50%,-66.6666666666666666%)
  -webkit-transform translate(-50%,-66.6666666666666666%)
  -webkit-animation animascale 2s linear alternate infinite
  animation animascale 2s linear alternate both infinite



.triangles-zero, .triangles-ein, .triangles-dvai, .triangles-trei, .triangles-feir, .triangles-fei, .triangles-sei, .triangles-seiz, .triangles-eiz
  width 0px
  height 0px
  position absolute
  top 50%
  left 50%
  transform translate(-50%,-66.6666666666666666%)
  -ms-transform translate(-50%,-66.6666666666666666%)
  -webkit-transform translate(-50%,-66.6666666666666666%)

.triangles-zero
  border-style solid
  border-width 0 5px 8.7px 5px
  border-color transparent transparent #1274b6 transparent
  -webkit-animation anima 2s linear reverse both infinite 4s, animacolorzero 2s linear alternate both infinite
  animation anima 2s linear reverse both infinite 4s, animacolorzero 2s linear alternate both infinite
  -webkit-transform-origin top left

.triangles-ein
  border-style solid
  border-width 0 10px 17.3px 10px
  border-color transparent transparent #167bbf transparent
  -webkit-animation anima 2s linear both infinite 4.2s, animacolorein 2s linear alternate both infinite
  animation anima 2s linear both infinite 4.2s, animacolorein 2s linear alternate both infinite
  -webkit-transform-origin top left

.triangles-dvai
  border-style solid
  border-width 0 20px 34.6px 20px
  border-color transparent transparent #1b82c8 transparent
  -webkit-animation anima 2s linear reverse both infinite 4.4s, animacolordvai 2s linear alternate both infinite
  animation anima 2s linear reverse both infinite 4.4s, animacolordvai 2s linear alternate both infinite
  -webkit-transform-origin top left

.triangles-trei
  border-style solid
  border-width 0 40px 69.3px 40px
  border-color transparent transparent #228bd2 transparent
  -webkit-animation anima 2s linear  both infinite 4.6s, animacolortrei 2s linear alternate both infinite
  animation anima 2s linear  both infinite 4.6s, animacolortrei 2s linear alternate both infinite
  -webkit-transform-origin top left

.triangles-feir
  border-style solid
  border-width 0 80px 138.6px 80px
  border-color transparent transparent #2992d9 transparent
  -webkit-animation anima 2s linear reverse  both infinite 4.8s, animacolorfeir 2s linear alternate both infinite
  animation anima 2s linear reverse  both infinite 4.8s, animacolorfeir 2s linear alternate both infinite
  -webkit-transform-origin top left

.triangles-fei
  border-style solid
  border-width 0 160px 277.1px 160px
  border-color transparent transparent #3498db transparent
  -webkit-animation anima 2s linear  both infinite 5s, animacolorfei 2s linear alternate both infinite
  animation anima 2s linear  both infinite 5s, animacolorfei 2s linear alternate both infinite
  -webkit-transform-origin top left

.triangles-sei
  border-style solid
  border-width 0 320px 554.3px 320px
  border-color transparent transparent #3f9edd transparent
  -webkit-animation anima 2s linear reverse  both infinite 5.2s, animacolorsei 2s linear alternate both infinite
  animation anima 2s linear reverse  both infinite 5.2s, animacolorsei 2s linear alternate both infinite
  -webkit-transform-origin top left

.triangles-seiz
  border-style solid
  border-width 0 640px 1108.5px 640px
  border-color transparent transparent #48a2de transparent
  -webkit-animation anima 2s linear  both infinite 5.4s, animacolorseiz 2s linear alternate both infinite
  animation anima 2s linear  both infinite 5.4s, animacolorseiz 2s linear alternate both infinite
  -webkit-transform-origin top left

.triangles-eiz
  border-style solid
  border-width 0 1280px 2217.0px 1280px
  border-color transparent transparent #59aae0 transparent
  -webkit-animation anima 2s linear reverse  both infinite 5.6s, animacoloreiz 2s linear alternate both infinite
  animation anima 2s linear reverse  both infinite 5.6s, animacoloreiz 2s linear alternate both infinite
  -webkit-transform-origin top left


@-webkit-keyframes anima
  from
    -webkit-transform: rotate(0deg) translate(-50%,-66.6666666666666666%)
  to
    -webkit-transform: rotate(360deg) translate(-50%,-66.6666666666666666%)


@keyframes anima
    from
      transform rotate(0deg) translate(-50%,-66.6666666666666666%)
    to
      transform rotate(360deg) translate(-50%,-66.6666666666666666%)



/*
@-webkit-keyframes animacolorzero
{
0%{border-color: transparent transparent #602520 transparent;}
16.6%{border-color: transparent transparent #672922 transparent;}
33.3%{border-color: transparent transparent #6F2E25 transparent;}
50%{border-color: transparent transparent #772F28 transparent;}
66.6%{border-color: transparent transparent #82332B transparent;}
83.3%{border-color: transparent transparent #8A372E transparent;}
100%{border-color: transparent transparent #A14436 transparent;}
}

@keyframes animacolorzero
{
0%{border-color: transparent transparent #602520 transparent;}
16.6%{border-color: transparent transparent #672922 transparent;}
33.3%{border-color: transparent transparent #6F2E25 transparent;}
50%{border-color: transparent transparent #772F28 transparent;}
66.6%{border-color: transparent transparent #82332B transparent;}
83.3%{border-color: transparent transparent #8A372E transparent;}
100%{border-color: transparent transparent #A14436 transparent;}
}


@-webkit-keyframes animacolorein
{
0%{border-color: transparent transparent #672922 transparent;}
16.6%{border-color: transparent transparent #6F2E25 transparent;}
33.3%{border-color: transparent transparent #772F28 transparent;}
50%{border-color: transparent transparent #82332B transparent;}
66.6%{border-color: transparent transparent #8A372E transparent;}
83.3%{border-color: transparent transparent #A14436 transparent;}
100%{border-color: transparent transparent #602520 transparent;}
}

@keyframes animacolorein
{
0%{border-color: transparent transparent #672922 transparent;}
16.6%{border-color: transparent transparent #6F2E25 transparent;}
33.3%{border-color: transparent transparent #772F28 transparent;}
50%{border-color: transparent transparent #82332B transparent;}
66.6%{border-color: transparent transparent #8A372E transparent;}
83.3%{border-color: transparent transparent #A14436 transparent;}
100%{border-color: transparent transparent #602520 transparent;}
}


@-webkit-keyframes animacolordvai
{
0%{border-color: transparent transparent #6F2E25 transparent;}
16.6%{border-color: transparent transparent #772F28 transparent;}
33.3%{border-color: transparent transparent #82332B transparent;}
50%{border-color: transparent transparent #8A372E transparent;}
66.6%{border-color: transparent transparent #A14436 transparent;}
83.3%{border-color: transparent transparent #602520 transparent;}
100%{border-color: transparent transparent #672922 transparent;}
}

@keyframes animacolordvai
{
0%{border-color: transparent transparent #6F2E25 transparent;}
16.6%{border-color: transparent transparent #772F28 transparent;}
33.3%{border-color: transparent transparent #82332B transparent;}
50%{border-color: transparent transparent #8A372E transparent;}
66.6%{border-color: transparent transparent #A14436 transparent;}
83.3%{border-color: transparent transparent #602520 transparent;}
100%{border-color: transparent transparent #672922 transparent;}
}


@-webkit-keyframes animacolortrei
{
0%{border-color: transparent transparent #772F28 transparent;}
16.6%{border-color: transparent transparent #82332B transparent;}
33.3%{border-color: transparent transparent #8A372E transparent;}
50%{border-color: transparent transparent #A14436 transparent;}
66.6%{border-color: transparent transparent #602520 transparent;}
83.3%{border-color: transparent transparent #672922 transparent;}
100%{border-color: transparent transparent #6F2E25 transparent;}
}

@keyframes animacolortrei
{
0%{border-color: transparent transparent #772F28 transparent;}
16.6%{border-color: transparent transparent #82332B transparent;}
33.3%{border-color: transparent transparent #8A372E transparent;}
50%{border-color: transparent transparent #A14436 transparent;}
66.6%{border-color: transparent transparent #602520 transparent;}
83.3%{border-color: transparent transparent #672922 transparent;}
100%{border-color: transparent transparent #6F2E25 transparent;}
}


@-webkit-keyframes animacolorfeir
{
0%{border-color: transparent transparent #82332B transparent;}
16.6%{border-color: transparent transparent #8A372E transparent;}
33.3%{border-color: transparent transparent #A14436 transparent;}
50%{border-color: transparent transparent #602520 transparent;}
66.6%{border-color: transparent transparent #672922 transparent;}
83.3%{border-color: transparent transparent #6F2E25 transparent;}
100%{border-color: transparent transparent #772F28 transparent;}
}

@keyframes animacolorfeir
{
0%{border-color: transparent transparent #82332B transparent;}
16.6%{border-color: transparent transparent #8A372E transparent;}
33.3%{border-color: transparent transparent #A14436 transparent;}
50%{border-color: transparent transparent #602520 transparent;}
66.6%{border-color: transparent transparent #672922 transparent;}
83.3%{border-color: transparent transparent #6F2E25 transparent;}
100%{border-color: transparent transparent #772F28 transparent;}
}



@-webkit-keyframes animacolorfei
{
0%{border-color: transparent transparent #8A372E transparent;}
16.6%{border-color: transparent transparent #A14436 transparent;}
33.3%{border-color: transparent transparent #602520 transparent;}
50%{border-color: transparent transparent #672922 transparent;}
66.6%{border-color: transparent transparent #6F2E25 transparent;}
83.3%{border-color: transparent transparent #772F28 transparent;}
100%{border-color: transparent transparent #82332B transparent;}
}

@keyframes animacolorfei
{
0%{border-color: transparent transparent #8A372E transparent;}
16.6%{border-color: transparent transparent #A14436 transparent;}
33.3%{border-color: transparent transparent #602520 transparent;}
50%{border-color: transparent transparent #672922 transparent;}
66.6%{border-color: transparent transparent #6F2E25 transparent;}
83.3%{border-color: transparent transparent #772F28 transparent;}
100%{border-color: transparent transparent #82332B transparent;}
}




@-webkit-keyframes animacolorsei
{
0%{border-color: transparent transparent #A14436 transparent;}
16.6%{border-color: transparent transparent #602520 transparent;}
33.3%{border-color: transparent transparent #672922 transparent;}
50%{border-color: transparent transparent #6F2E25 transparent;}
66.6%{border-color: transparent transparent #772F28 transparent;}
83.3%{border-color: transparent transparent #82332B transparent;}
100%{border-color: transparent transparent #8A372E transparent;}
}

@keyframes animacolorsei
{
0%{border-color: transparent transparent #A14436 transparent;}
16.6%{border-color: transparent transparent #602520 transparent;}
33.3%{border-color: transparent transparent #672922 transparent;}
50%{border-color: transparent transparent #6F2E25 transparent;}
66.6%{border-color: transparent transparent #772F28 transparent;}
83.3%{border-color: transparent transparent #82332B transparent;}
100%{border-color: transparent transparent #8A372E transparent;}
}*/

@-webkit-keyframes animacolorzero
{
0%{border-color: transparent transparent #1274b6 transparent;}
12.5%{border-color: transparent transparent #167bbf transparent;}
25%{border-color: transparent transparent #1b82c8 transparent;}
37.5%{border-color: transparent transparent #228bd2 transparent;}
50%{border-color: transparent transparent #2992d9 transparent;}
62.5%{border-color: transparent transparent #3498db transparent;}
75%{border-color: transparent transparent #3f9edd transparent;}
87.5%{border-color: transparent transparent #48a2de transparent;}
100%{border-color: transparent transparent #59aae0 transparent;}
}

@keyframes animacolorzero
{
0%{border-color: transparent transparent #1274b6 transparent;}
12.5%{border-color: transparent transparent #167bbf transparent;}
25%{border-color: transparent transparent #1b82c8 transparent;}
37.5%{border-color: transparent transparent #228bd2 transparent;}
50%{border-color: transparent transparent #2992d9 transparent;}
62.5%{border-color: transparent transparent #3498db transparent;}
75%{border-color: transparent transparent #3f9edd transparent;}
87.5%{border-color: transparent transparent #48a2de transparent;}
100%{border-color: transparent transparent #59aae0 transparent;}
}

@-webkit-keyframes animacolorein
{
0%{border-color: transparent transparent #167bbf transparent;}
12.5%{border-color: transparent transparent #1b82c8 transparent;}
25%{border-color: transparent transparent #228bd2 transparent;}
37.5%{border-color: transparent transparent #2992d9 transparent;}
50%{border-color: transparent transparent #3498db transparent;}
62.5%{border-color: transparent transparent #3f9edd transparent;}
75%{border-color: transparent transparent #48a2de transparent;}
87.5%{border-color: transparent transparent #59aae0 transparent;}
100%{border-color: transparent transparent #1274b6 transparent;}
}

@keyframes animacolorein
{
0%{border-color: transparent transparent #167bbf transparent;}
12.5%{border-color: transparent transparent #1b82c8 transparent;}
25%{border-color: transparent transparent #228bd2 transparent;}
37.5%{border-color: transparent transparent #2992d9 transparent;}
50%{border-color: transparent transparent #3498db transparent;}
62.5%{border-color: transparent transparent #3f9edd transparent;}
75%{border-color: transparent transparent #48a2de transparent;}
87.5%{border-color: transparent transparent #59aae0 transparent;}
100%{border-color: transparent transparent #1274b6 transparent;}
}

@-webkit-keyframes animacolordvai
{
0%{border-color: transparent transparent #1b82c8 transparent;}
12.5%{border-color: transparent transparent #228bd2 transparent;}
25%{border-color: transparent transparent #2992d9 transparent;}
37.5%{border-color: transparent transparent #3498db transparent;}
50%{border-color: transparent transparent #3f9edd transparent;}
62.5%{border-color: transparent transparent #48a2de transparent;}
75%{border-color: transparent transparent #59aae0 transparent;}
87.5%{border-color: transparent transparent #1274b6 transparent;}
100%{border-color: transparent transparent #167bbf transparent;}
}

@keyframes animacolordvai
{
0%{border-color: transparent transparent #1b82c8 transparent;}
12.5%{border-color: transparent transparent #228bd2 transparent;}
25%{border-color: transparent transparent #2992d9 transparent;}
37.5%{border-color: transparent transparent #3498db transparent;}
50%{border-color: transparent transparent #3f9edd transparent;}
62.5%{border-color: transparent transparent #48a2de transparent;}
75%{border-color: transparent transparent #59aae0 transparent;}
87.5%{border-color: transparent transparent #1274b6 transparent;}
100%{border-color: transparent transparent #167bbf transparent;}
}

@-webkit-keyframes animacolortrei
{
0%{border-color: transparent transparent #228bd2 transparent;}
12.5%{border-color: transparent transparent #2992d9 transparent;}
25%{border-color: transparent transparent #3498db transparent;}
37.5%{border-color: transparent transparent #3f9edd transparent;}
50%{border-color: transparent transparent #48a2de transparent;}
62.5%{border-color: transparent transparent #59aae0 transparent;}
75%{border-color: transparent transparent #1274b6 transparent;}
87.5%{border-color: transparent transparent #167bbf transparent;}
100%{border-color: transparent transparent #1b82c8 transparent;}
}

@keyframes animacolortrei
{
0%{border-color: transparent transparent #228bd2 transparent;}
12.5%{border-color: transparent transparent #2992d9 transparent;}
25%{border-color: transparent transparent #3498db transparent;}
37.5%{border-color: transparent transparent #3f9edd transparent;}
50%{border-color: transparent transparent #48a2de transparent;}
62.5%{border-color: transparent transparent #59aae0 transparent;}
75%{border-color: transparent transparent #1274b6 transparent;}
87.5%{border-color: transparent transparent #167bbf transparent;}
100%{border-color: transparent transparent #1b82c8 transparent;}
}

@-webkit-keyframes animacolorfeir
{
0%{border-color: transparent transparent #2992d9 transparent;}
12.5%{border-color: transparent transparent #3498db transparent;}
25%{border-color: transparent transparent #3f9edd transparent;}
37.5%{border-color: transparent transparent #48a2de transparent;}
50%{border-color: transparent transparent #59aae0 transparent;}
62.5%{border-color: transparent transparent #1274b6 transparent;}
75%{border-color: transparent transparent #167bbf transparent;}
87.5%{border-color: transparent transparent #1b82c8 transparent;}
100%{border-color: transparent transparent #228bd2 transparent;}
}

@keyframes animacolorfeir
{
0%{border-color: transparent transparent #2992d9 transparent;}
12.5%{border-color: transparent transparent #3498db transparent;}
25%{border-color: transparent transparent #3f9edd transparent;}
37.5%{border-color: transparent transparent #48a2de transparent;}
50%{border-color: transparent transparent #59aae0 transparent;}
62.5%{border-color: transparent transparent #1274b6 transparent;}
75%{border-color: transparent transparent #167bbf transparent;}
87.5%{border-color: transparent transparent #1b82c8 transparent;}
100%{border-color: transparent transparent #228bd2 transparent;}
}

@-webkit-keyframes animacolorfei
{
0%{border-color: transparent transparent #3498db transparent;}
12.5%{border-color: transparent transparent #3f9edd transparent;}
25%{border-color: transparent transparent #48a2de transparent;}
37.5%{border-color: transparent transparent #59aae0 transparent;}
50%{border-color: transparent transparent #1274b6 transparent;}
62.5%{border-color: transparent transparent #167bbf transparent;}
75%{border-color: transparent transparent #1b82c8 transparent;}
87.5%{border-color: transparent transparent #228bd2 transparent;}
100%{border-color: transparent transparent #2992d9 transparent;}
}

@keyframes animacolorfei
{
0%{border-color: transparent transparent #3498db transparent;}
12.5%{border-color: transparent transparent #3f9edd transparent;}
25%{border-color: transparent transparent #48a2de transparent;}
37.5%{border-color: transparent transparent #59aae0 transparent;}
50%{border-color: transparent transparent #1274b6 transparent;}
62.5%{border-color: transparent transparent #167bbf transparent;}
75%{border-color: transparent transparent #1b82c8 transparent;}
87.5%{border-color: transparent transparent #228bd2 transparent;}
100%{border-color: transparent transparent #2992d9 transparent;}
}

@-webkit-keyframes animacolorsei
{
0%{border-color: transparent transparent #3f9edd transparent;}
12.5%{border-color: transparent transparent #48a2de transparent;}
25%{border-color: transparent transparent #59aae0 transparent;}
37.5%{border-color: transparent transparent #1274b6 transparent;}
50%{border-color: transparent transparent #167bbf transparent;}
62.5%{border-color: transparent transparent #1b82c8 transparent;}
75%{border-color: transparent transparent #228bd2 transparent;}
87.5%{border-color: transparent transparent #2992d9 transparent;}
100%{border-color: transparent transparent #3498db transparent;}
}

@keyframes animacolorsei
{
0%{border-color: transparent transparent #3f9edd transparent;}
12.5%{border-color: transparent transparent #48a2de transparent;}
25%{border-color: transparent transparent #59aae0 transparent;}
37.5%{border-color: transparent transparent #1274b6 transparent;}
50%{border-color: transparent transparent #167bbf transparent;}
62.5%{border-color: transparent transparent #1b82c8 transparent;}
75%{border-color: transparent transparent #228bd2 transparent;}
87.5%{border-color: transparent transparent #2992d9 transparent;}
100%{border-color: transparent transparent #3498db transparent;}
}

@-webkit-keyframes animacolorseiz
{
0%{border-color: transparent transparent #48a2de transparent;}
12.5%{border-color: transparent transparent #59aae0 transparent;}
25%{border-color: transparent transparent #1274b6 transparent;}
37.5%{border-color: transparent transparent #167bbf transparent;}
50%{border-color: transparent transparent #1b82c8 transparent;}
62.5%{border-color: transparent transparent #228bd2 transparent;}
75%{border-color: transparent transparent #2992d9 transparent;}
87.5%{border-color: transparent transparent #3498db transparent;}
100%{border-color: transparent transparent #3f9edd transparent;}
}

@keyframes animacolorseiz
{
0%{border-color: transparent transparent #48a2de transparent;}
12.5%{border-color: transparent transparent #59aae0 transparent;}
25%{border-color: transparent transparent #1274b6 transparent;}
37.5%{border-color: transparent transparent #167bbf transparent;}
50%{border-color: transparent transparent #1b82c8 transparent;}
62.5%{border-color: transparent transparent #228bd2 transparent;}
75%{border-color: transparent transparent #2992d9 transparent;}
87.5%{border-color: transparent transparent #3498db transparent;}
100%{border-color: transparent transparent #3f9edd transparent;}
}

@-webkit-keyframes animacoloreiz
{
0%{border-color: transparent transparent #59aae0 transparent;}
12.5%{border-color: transparent transparent #1274b6 transparent;}
25%{border-color: transparent transparent #167bbf transparent;}
37.5%{border-color: transparent transparent #1b82c8 transparent;}
50%{border-color: transparent transparent #228bd2 transparent;}
62.5%{border-color: transparent transparent #2992d9 transparent;}
75%{border-color: transparent transparent #3498db transparent;}
87.5%{border-color: transparent transparent #3f9edd transparent;}
100%{border-color: transparent transparent #48a2de transparent;}
}

@keyframes animacoloreiz
{
0%{border-color: transparent transparent #59aae0 transparent;}
12.5%{border-color: transparent transparent #1274b6 transparent;}
25%{border-color: transparent transparent #167bbf transparent}
37.5%{border-color: transparent transparent #1b82c8 transparent;}
50%{border-color: transparent transparent #228bd2 transparent;}
62.5%{border-color: transparent transparent #2992d9 transparent;}
75%{border-color: transparent transparent #3498db transparent;}
87.5%{border-color: transparent transparent #3f9edd transparent;}
100%{border-color: transparent transparent #48a2de transparent;}
}

@-webkit-keyframes animascale
{
0%{-webkit-transform: scale(1);}
100%{-webkit-transform: scale(1.2);}
}

@keyframes animascale
{
0%{-webkit-transform: scale(1);}
100%{-webkit-transform: scale(1.2);}
}

```

## `wizard.styl`

```styl wizard.styl
.loading-bg
  position fixed
  z-index 1000
  width 50%
  height 100%
  background var(--preloader-bg)
#loading-box
  .loading-left-bg
    @extend .loading-bg
    left 0
  .loading-right-bg
    @extend .loading-bg
    right 0
  &.loaded
    z-index -1000
    .loading-left-bg
      transition all 1.0s
      transform translate(-100%, 0)
    .loading-right-bg
      transition all 1.0s
      transform translate(100%, 0)
#loading-box
  position fixed
  z-index 1000
  display -webkit-box
  display flex
  -webkit-box-align center
  align-items center
  -webkit-box-pack center
  justify-content center
  -webkit-box-orient vertical
  -webkit-box-direction normal
  flex-direction column
  flex-wrap wrap
  width 100vw
  height 100vh
  overflow hidden

  &.loaded
    .wizard-scene
      display none

.wizard-scene
  position fixed
  z-index 1001
  display -webkit-box
  display flex

.wizard
  position relative
  width 190px
  height 240px

.wizard-body
  position absolute
  bottom 0
  left 68px
  height 100px
  width 60px
  background #3f64ce
  &::after
    content ""
    position absolute
    bottom 0
    left 20px
    height 100px
    width 60px
    background #3f64ce
    -webkit-transform skewX(14deg)
    transform skewX(14deg)

.wizard-right-arm
  position absolute
  bottom 74px
  left 110px
  height 44px
  width 90px
  background #3f64ce
  border-radius 22px
  -webkit-transform-origin 16px 22px
  transform-origin 16px 22px
  -webkit-transform rotate(70deg)
  transform rotate(70deg)
  -webkit-animation right_arm 10s ease-in-out infinite
  animation right_arm 10s ease-in-out infinite
  .right-hand
    position absolute
    right 8px
    bottom 8px
    width 30px
    height 30px
    border-radius 50%
    background #f1c5b4
    -webkit-transform-origin center center
    transform-origin center center
    -webkit-transform rotate(-40deg)
    transform rotate(-40deg)
    -webkit-animation right_hand 10s ease-in-out infinite
    animation right_hand 10s ease-in-out infinite
  .wizard-right-hand
    &::after
      content ""
      position absolute
      right 0px
      top -8px
      width 15px
      height 30px
      border-radius 10px
      background #f1c5b4
      -webkit-transform translateY(16px)
      transform translateY(16px)
      -webkit-animation right_finger 10s ease-in-out infinite
      animation right_finger 10s ease-in-out infinite

.wizard-left-arm
  position absolute
  bottom 74px
  left 26px
  height 44px
  width 70px
  background #3f64ce
  border-bottom-left-radius 8px
  -webkit-transform-origin 60px 26px
  transform-origin 60px 26px
  -webkit-transform rotate(-70deg)
  transform rotate(-70deg)
  -webkit-animation left_arm 10s ease-in-out infinite
  animation left_arm 10s ease-in-out infinite
  .wizard-left-hand
    position absolute
    left -18px
    top 0
    width 18px
    height 30px
    border-top-left-radius 35px
    border-bottom-left-radius 35px
    background #f1c5b4
    &::after
      content ""
      position absolute
      right 0
      top 0
      width 30px
      height 15px
      border-radius 20px
      background #f1c5b4
      -webkit-transform-origin right bottom
      transform-origin right bottom
      -webkit-transform scaleX(0)
      transform scaleX(0)
      -webkit-animation left_finger 10s ease-in-out infinite
      animation left_finger 10s ease-in-out infinite

.wizard-head
  position absolute
  top 0
  left 14px
  width 160px
  height 210px
  -webkit-transform-origin center center
  transform-origin center center
  -webkit-transform rotate(-3deg)
  transform rotate(-3deg)
  -webkit-animation head 10s ease-in-out infinite
  animation head 10s ease-in-out infinite
  .wizard-beard
    position absolute
    bottom 0
    left 38px
    height 106px
    width 80px
    border-bottom-right-radius 55%
    background #ffffff
    &::after
      content ""
      position absolute
      top 16px
      left -10px
      width 40px
      height 20px
      border-radius 20px
      background #ffffff
  .wizard-face
    position absolute
    bottom 76px
    left 38px
    height 30px
    width 60px
    background #f1c5b4
    &::before
      content ""
      position absolute
      top 0px
      left 40px
      width 20px
      height 40px
      border-bottom-right-radius 20px
      border-bottom-left-radius 20px
      background #f1c5b4
    &::after
      content ""
      position absolute
      top 16px
      left -10px
      width 50px
      height 20px
      border-radius 20px
      border-bottom-right-radius 0px
      background #ffffff
    .wizard-adds
      position absolute
      top 0px
      left -10px
      width 40px
      height 20px
      border-radius 20px
      background #f1c5b4
      &::after
        content ""
        position absolute
        top 5px
        left 80px
        width 15px
        height 20px
        border-bottom-right-radius 20px
        border-top-right-radius 20px
        background #f1c5b4
  .wizard-hat
    position absolute
    bottom 106px
    left 0
    width 160px
    height 20px
    border-radius 20px
    background #3f64ce
    &::before
      content ""
      position absolute
      top -70px
      left 50%
      -webkit-transform translatex(-50%)
      transform translatex(-50%)
      width 0
      height 0
      border-style solid
      border-width 0 34px 70px 50px
      border-color transparent transparent #3f64ce transparent
    &::after
      content ""
      position absolute
      top 0
      left 0
      width 160px
      height 20px
      background #3f64ce
      border-radius 20px
    .wizard-hat-of-the-hat
      position absolute
      bottom 78px
      left 79px
      width 0
      height 0
      border-style solid
      border-width 0 25px 25px 19px
      border-color transparent transparent #3f64ce transparent
      &::after
        content ""
        position absolute
        top 6px
        left -4px
        width 35px
        height 10px
        border-radius 10px
        border-bottom-left-radius 0px
        background #3f64ce
        -webkit-transform rotate(40deg)
        transform rotate(40deg)
    .wizard-four-point-star
      position absolute
      width 12px
      height 12px
      &::after
        -webkit-transform rotate(156.66deg) skew(45deg)
        transform rotate(156.66deg) skew(45deg)
      &.--first
        bottom 28px
        left 46px
      &.--second
        bottom 40px
        left 80px
      &.--third
        bottom 15px
        left 108px

.wizard-head .wizard-hat .wizard-four-point-star::after, .wizard-head .wizard-hat .wizard-four-point-star::before
  content ""
  position absolute
  background #ffffff
  display block
  left 0
  width 141.4213%
  top 0
  bottom 0
  border-radius 10%
  -webkit-transform rotate(66.66deg) skewX(45deg)
  transform rotate(66.66deg) skewX(45deg)

.wizard-objects
  position relative
  width 200px
  height 240px

.wizard-square
  position absolute
  bottom -60px
  left -5px
  width 120px
  height 120px
  border-radius 50%
  -webkit-transform rotate(-360deg)
  transform rotate(-360deg)
  -webkit-animation path_square 10s ease-in-out infinite
  animation path_square 10s ease-in-out infinite
  &::after
    content ""
    position absolute
    top 10px
    left 0
    width 50px
    height 50px
    background #9ab3f5

.wizard-circle
  position absolute
  bottom 10px
  left 0
  width 100px
  height 100px
  border-radius 50%
  -webkit-transform rotate(-360deg)
  transform rotate(-360deg)
  -webkit-animation path_circle 10s ease-in-out infinite
  animation path_circle 10s ease-in-out infinite
  &::after
    content ""
    position absolute
    bottom -10px
    left 25px
    width 50px
    height 50px
    border-radius 50%
    background #c56183

.wizard-triangle
  position absolute
  bottom -62px
  left -10px
  width 110px
  height 110px
  border-radius 50%
  -webkit-transform rotate(-360deg)
  transform rotate(-360deg)
  -webkit-animation path_triangle 10s ease-in-out infinite
  animation path_triangle 10s ease-in-out infinite
  &::after
    content ""
    position absolute
    top 0
    right -10px
    width 0
    height 0
    border-style solid
    border-width 0 28px 48px 28px
    border-color transparent transparent #89beb3 transparent


/** 10s animation - 10% = 1s */
@-webkit-keyframes right_arm
  0%
    -webkit-transform rotate(70deg)
    transform rotate(70deg)
  10%
    -webkit-transform rotate(8deg)
    transform rotate(8deg)
  15%
    -webkit-transform rotate(20deg)
    transform rotate(20deg)
  20%
    -webkit-transform rotate(10deg)
    transform rotate(10deg)
  25%
    -webkit-transform rotate(26deg)
    transform rotate(26deg)
  30%
    -webkit-transform rotate(10deg)
    transform rotate(10deg)
  35%
    -webkit-transform rotate(28deg)
    transform rotate(28deg)
  40%
    -webkit-transform rotate(9deg)
    transform rotate(9deg)
  45%
    -webkit-transform rotate(28deg)
    transform rotate(28deg)
  50%
    -webkit-transform rotate(8deg)
    transform rotate(8deg)
  58%
    -webkit-transform rotate(74deg)
    transform rotate(74deg)
  62%
    -webkit-transform rotate(70deg)
    transform rotate(70deg)

@keyframes right_arm
  0%
    -webkit-transform rotate(70deg)
    transform rotate(70deg)
  10%
    -webkit-transform rotate(8deg)
    transform rotate(8deg)
  15%
    -webkit-transform rotate(20deg)
    transform rotate(20deg)
  20%
    -webkit-transform rotate(10deg)
    transform rotate(10deg)
  25%
    -webkit-transform rotate(26deg)
    transform rotate(26deg)
  30%
    -webkit-transform rotate(10deg)
    transform rotate(10deg)
  35%
    -webkit-transform rotate(28deg)
    transform rotate(28deg)
  40%
    -webkit-transform rotate(9deg)
    transform rotate(9deg)
  45%
    -webkit-transform rotate(28deg)
    transform rotate(28deg)
  50%
    -webkit-transform rotate(8deg)
    transform rotate(8deg)
  58%
    -webkit-transform rotate(74deg)
    transform rotate(74deg)
  62%
    -webkit-transform rotate(70deg)
    transform rotate(70deg)

@-webkit-keyframes left_arm
  0%
    -webkit-transform rotate(-70deg)
    transform rotate(-70deg)
  10%
    -webkit-transform rotate(6deg)
    transform rotate(6deg)
  15%
    -webkit-transform rotate(-18deg)
    transform rotate(-18deg)
  20%
    -webkit-transform rotate(5deg)
    transform rotate(5deg)
  25%
    -webkit-transform rotate(-18deg)
    transform rotate(-18deg)
  30%
    -webkit-transform rotate(5deg)
    transform rotate(5deg)
  35%
    -webkit-transform rotate(-17deg)
    transform rotate(-17deg)
  40%
    -webkit-transform rotate(5deg)
    transform rotate(5deg)
  45%
    -webkit-transform rotate(-18deg)
    transform rotate(-18deg)
  50%
    -webkit-transform rotate(6deg)
    transform rotate(6deg)
  58%
    -webkit-transform rotate(-74deg)
    transform rotate(-74deg)
  62%
    -webkit-transform rotate(-70deg)
    transform rotate(-70deg)

@keyframes left_arm
  0%
    -webkit-transform rotate(-70deg)
    transform rotate(-70deg)
  10%
    -webkit-transform rotate(6deg)
    transform rotate(6deg)
  15%
    -webkit-transform rotate(-18deg)
    transform rotate(-18deg)
  20%
    -webkit-transform rotate(5deg)
    transform rotate(5deg)
  25%
    -webkit-transform rotate(-18deg)
    transform rotate(-18deg)
  30%
    -webkit-transform rotate(5deg)
    transform rotate(5deg)
  35%
    -webkit-transform rotate(-17deg)
    transform rotate(-17deg)
  40%
    -webkit-transform rotate(5deg)
    transform rotate(5deg)
  45%
    -webkit-transform rotate(-18deg)
    transform rotate(-18deg)
  50%
    -webkit-transform rotate(6deg)
    transform rotate(6deg)
  58%
    -webkit-transform rotate(-74deg)
    transform rotate(-74deg)
  62%
    -webkit-transform rotate(-70deg)
    transform rotate(-70deg)

@-webkit-keyframes right_hand
  0%
    -webkit-transform rotate(-40deg)
    transform rotate(-40deg)
  10%
    -webkit-transform rotate(-20deg)
    transform rotate(-20deg)
  15%
    -webkit-transform rotate(-5deg)
    transform rotate(-5deg)
  20%
    -webkit-transform rotate(-60deg)
    transform rotate(-60deg)
  25%
    -webkit-transform rotate(0deg)
    transform rotate(0deg)
  30%
    -webkit-transform rotate(-60deg)
    transform rotate(-60deg)
  35%
    -webkit-transform rotate(0deg)
    transform rotate(0deg)
  40%
    -webkit-transform rotate(-40deg)
    transform rotate(-40deg)
  45%
    -webkit-transform rotate(-60deg)
    transform rotate(-60deg)
  50%
    -webkit-transform rotate(10deg)
    transform rotate(10deg)
  60%
    -webkit-transform rotate(-40deg)
    transform rotate(-40deg)


@keyframes right_hand
  0%
    -webkit-transform rotate(-40deg)
    transform rotate(-40deg)
  10%
    -webkit-transform rotate(-20deg)
    transform rotate(-20deg)
  15%
    -webkit-transform rotate(-5deg)
    transform rotate(-5deg)
  20%
    -webkit-transform rotate(-60deg)
    transform rotate(-60deg)
  25%
    -webkit-transform rotate(0deg)
    transform rotate(0deg)
  30%
    -webkit-transform rotate(-60deg)
    transform rotate(-60deg)
  35%
    -webkit-transform rotate(0deg)
    transform rotate(0deg)
  40%
    -webkit-transform rotate(-40deg)
    transform rotate(-40deg)
  45%
    -webkit-transform rotate(-60deg)
    transform rotate(-60deg)
  50%
    -webkit-transform rotate(10deg)
    transform rotate(10deg)
  60%
    -webkit-transform rotate(-40deg)
    transform rotate(-40deg)

@-webkit-keyframes right_finger
  0%
    -webkit-transform translateY(16px)
    transform translateY(16px)
  10%
    -webkit-transform none
    transform none
  50%
    -webkit-transform none
    transform none
  60%
    -webkit-transform translateY(16px)
    transform translateY(16px)

@keyframes right_finger
  0%
    -webkit-transform translateY(16px)
    transform translateY(16px)
  10%
    -webkit-transform none
    transform none
  50%
    -webkit-transform none
    transform none
  60%
    -webkit-transform translateY(16px)
    transform translateY(16px)

@-webkit-keyframes left_finger
  0%
    -webkit-transform scaleX(0)
    transform scaleX(0)
  10%
    -webkit-transform scaleX(1) rotate(6deg)
    transform scaleX(1) rotate(6deg)
  15%
    -webkit-transform scaleX(1) rotate(0deg)
    transform scaleX(1) rotate(0deg)
  20%
    -webkit-transform scaleX(1) rotate(8deg)
    transform scaleX(1) rotate(8deg)
  25%
    -webkit-transform scaleX(1) rotate(0deg)
    transform scaleX(1) rotate(0deg)
  30%
    -webkit-transform scaleX(1) rotate(7deg)
    transform scaleX(1) rotate(7deg)
  35%
    -webkit-transform scaleX(1) rotate(0deg)
    transform scaleX(1) rotate(0deg)
  40%
    -webkit-transform scaleX(1) rotate(5deg)
    transform scaleX(1) rotate5deg)
  45%
    -webkit-transform scaleX(1) rotate(0deg)
    transform scaleX(1) rotate(0deg)
  50%
    -webkit-transform scaleX(1) rotate(6deg)
    transform scaleX(1) rotate(6deg)
  58%
    -webkit-transform scaleX(0)
    transform scaleX(0)

@keyframes left_finger
  0%
    -webkit-transform scaleX(0)
    transform scaleX(0)
  10%
    -webkit-transform scaleX(1) rotate(6deg)
    transform scaleX(1) rotate(6deg)
  15%
    -webkit-transform scaleX(1) rotate(0deg)
    transform scaleX(1) rotate(0deg)
  20%
    -webkit-transform scaleX(1) rotate(8deg)
    transform scaleX(1) rotate(8deg)
  25%
    -webkit-transform scaleX(1) rotate(0deg)
    transform scaleX(1) rotate(0deg)
  30%
    -webkit-transform scaleX(1) rotate(7deg)
    transform scaleX(1) rotate(7deg)
  35%
    -webkit-transform scaleX(1) rotate(0deg)
    transform scaleX(1) rotate(0deg)
  40%
    -webkit-transform scaleX(1) rotate(5deg)
    transform scaleX(1) rotate(5deg)
  45%
    -webkit-transform scaleX(1) rotate(0deg)
    transform scaleX(1) rotate(0deg)
  50%
    -webkit-transform scaleX(1) rotate(6deg)
    transform scaleX(1) rotate(6deg)
  58%
    -webkit-transform scaleX(0)
    transform scaleX(0)

@-webkit-keyframes head
  0%
    -webkit-transform rotate(-3deg)
    transform rotate(-3deg)
  10%
    -webkit-transform translatex(10px) rotate(7deg)
    transform translatex(10px) rotate(7deg)
  50%
    -webkit-transform translatex(0px) rotate(0deg)
    transform translatex(0px) rotate(0deg)
  56%
    -webkit-transform rotate(-3deg)
    transform rotate(-3deg)

@keyframes head
  0%
    -webkit-transform rotate(-3deg)
    transform rotate(-3deg)
  10%
    -webkit-transform translatex(10px) rotate(7deg)
    transform translatex(10px) rotate(7deg)
  50%
    -webkit-transform translatex(0px) rotate(0deg)
    transform translatex(0px) rotate(0deg)
  56%
    -webkit-transform rotate(-3deg)
    transform rotate(-3deg)
/** 10s animation - 10% = 1s */
@-webkit-keyframes path_circle
  0%
    -webkit-transform translateY(0)
    transform translateY(0)
  10%
    -webkit-transform translateY(-100px) rotate(-5deg)
    transform translateY(-100px) rotate(-5deg)
  55%
    -webkit-transform translateY(-100px) rotate(-360deg)
    transform translateY(-100px) rotate(-360deg)
  58%
    -webkit-transform translateY(-100px) rotate(-360deg)
    transform translateY(-100px) rotate(-360deg)
  63%
    -webkit-transform rotate(-360deg)
    transform rotate(-360deg)

@keyframes path_circle
  0%
    -webkit-transform translateY(0)
    transform translateY(0)
  10%
    -webkit-transform translateY(-100px) rotate(-5deg)
    transform translateY(-100px) rotate(-5deg)
  55%
    -webkit-transform translateY(-100px) rotate(-360deg)
    transform translateY(-100px) rotate(-360deg)
  58%
    -webkit-transform translateY(-100px) rotate(-360deg)
    transform translateY(-100px) rotate(-360deg)
  63%
    -webkit-transform rotate(-360deg)
    transform rotate(-360deg)

@-webkit-keyframes path_square
  0%
    -webkit-transform translateY(0)
    transform translateY(0)
  10%
    -webkit-transform translateY(-155px) translatex(-15px) rotate(10deg)
    transform translateY(-155px) translatex(-15px) rotate(10deg)
  55%
    -webkit-transform translateY(-155px) translatex(-15px) rotate(-350deg)
    transform translateY(-155px) translatex(-15px) rotate(-350deg)
  57%
    -webkit-transform translateY(-155px) translatex(-15px) rotate(-350deg)
    transform translateY(-155px) translatex(-15px) rotate(-350deg)
  63%
    -webkit-transform rotate(-360deg)
    transform rotate(-360deg)

@keyframes path_square
  0%
    -webkit-transform translateY(0)
    transform translateY(0)
  10%
    -webkit-transform translateY(-155px) translatex(-15px) rotate(10deg)
    transform translateY(-155px) translatex(-15px) rotate(10deg)
  55%
    -webkit-transform translateY(-155px) translatex(-15px) rotate(-350deg)
    transform translateY(-155px) translatex(-15px) rotate(-350deg)
  57%
    -webkit-transform translateY(-155px) translatex(-15px) rotate(-350deg)
    transform translateY(-155px) translatex(-15px) rotate(-350deg)
  63%
    -webkit-transform rotate(-360deg)
    transform rotate(-360deg)

@-webkit-keyframes path_triangle
  0%
    -webkit-transform translateY(0)
    transform translateY(0)
  10%
    -webkit-transform translateY(-172px) translatex(10px) rotate(-10deg)
    transform translateY(-172px) translatex(10px) rotate(-10deg)
  55%
    -webkit-transform translateY(-172px) translatex(10px) rotate(-365deg)
    transform translateY(-172px) translatex(10px) rotate(-365deg)
  58%
    -webkit-transform translateY(-172px) translatex(10px) rotate(-365deg)
    transform translateY(-172px) translatex(10px) rotate(-365deg)
  63%
    -webkit-transform rotate(-360deg)
    transform rotate(-360deg)

@keyframes path_triangle
  0%
    -webkit-transform translateY(0)
    transform translateY(0)
  10%
    -webkit-transform translateY(-172px) translatex(10px) rotate(-10deg)
    transform translateY(-172px) translatex(10px) rotate(-10deg)
  55%
    -webkit-transform translateY(-172px) translatex(10px) rotate(-365deg)
    transform translateY(-172px) translatex(10px) rotate(-365deg)
  58%
    -webkit-transform translateY(-172px) translatex(10px) rotate(-365deg)
    transform translateY(-172px) translatex(10px) rotate(-365deg)
  63%
    -webkit-transform rotate(-360deg)
    transform rotate(-360deg)

```

# Optional Section, modified `var.styl`

under `themes/butterfly/source/css/`.
find `// preloader `:

removed line with `-`, add line with `+`.

```styl var.styl
      // preloader
-     $preloader-bg = #37474f
+     $preloader-bg = hexo-config('preloader.enable') && hexo-config('preloader.load_color') ? convert(hexo-config('preloader.load_color')) : #37474f
      $preloader-word-color = #fff
```

This allows you to modified background color for loading in `config.butterfly.yml`.

# Modified `_config.butterfly.yml`

same rule for `-` and `+`.

```yml _config.butterfly.yml
    # Loading Animation (加載動畫)
-   preloader:
-     enable: false
+   preloader:
+     enable: true # true|false
+     load_color: '#000000' # '#37474f'
+     load_style: gear # default|gear|ironheart|scarecrow|triangles|wizard|image
```

# Small Tip to view your updated loading

If your blog just started no long, you will find the loading screen end in 0.5s...
To see the effect, we will temporary let it load forever.

find the `fullpage-loading.pug` under `themes/butterfly/layout/includes/loading/`.
hide or delete this line.

```pug fullpage-loading.pug
window.addEventListener('load',()=> { preloader.endLoading() })
```

Please **REMEMBER** to change it back after you done testing.

translated and updated content from this article: [lihang](https://lihang.games/2022/06/26/Hexo-Butterfly%E5%8A%A0%E8%BD%BD%E5%8A%A8%E7%94%BB%E7%9A%84%E9%AD%94%E6%94%B9/)