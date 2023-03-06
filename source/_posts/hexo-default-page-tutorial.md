---
title: Hexo Change Default to Page
tags:
  - hexo
  - blog
description: >-
  This is to change Hexo default link point to a custom page, instead of the
  blog.
date: 2023-03-02 21:54:56
id: blog_3
---

### Concept

0. First we need understand how Hexo's **blog page** works.
  - By default, Hexo will create a **blog page** that will showcase all your posts. Refer to [this](https://hexo.io/docs/configuration.html#Home-page-setting).
  - Hexo creates a `index.html`, which is your **blog page**, when deploy using `hexo d` or `hexo deploy`.
  - This is all based on the pre-installed module `hexo-generator-index`, which you can config under `_config.yml` file:

  ```yml
    index_generator:
      path: ''
      per_page: 10
      order_by: -date
  ```

  - the value from `path` adds suffix to your website url.

##### If you want to display your custom page by default instead of the "blog page", follow steps below.

1. Deploy your **blog page** somewhere else.

  - Go to file `_config.yml`, find these lines:
  ```yml
      index_generator:
        path: ''
        per_page: 10
        order_by: -date
  ```
  - Edit value in `path`, for example I change to follow:
  ```yml
      index_generator:
        path: 'blog'
        per_page: 10
        order_by: -date
  ```
    - This will create the **blog page** inside a `blog` directory, from `path: 'blog'`.
    - Now if you want to access your **blog page**, just visit "__your_website_url/blog/__". For example, my website is "__https://jacklee981229.github.io/__", the url to my **blog page** will be "__https://jacklee981229.github.io/blog/__".
  - After first step, you will get error when trying to accessing your website's main url, as the `index.html` is not auto-generated anymore. Therefore you will need to create a `index.md` file under `source` folder manually.  
2. Create your own default page.

  - Create a `index.md` under source folder. Other naming will require additional works. So we are stick to `index.md` in this case.
    - Type in `Hello World!` in your `index.md`.
  - You are all set! Run `hexo g` && `hexo s` and you shall see your `Hello World!` message.
3. You can edit your `index.md` to show all your writings, all your posts and pages.
4. Visit [mine](https://jacklee981229.github.io/) for an idea!