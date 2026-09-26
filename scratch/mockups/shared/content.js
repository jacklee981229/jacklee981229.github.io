// Real content from https://jacklee981229.github.io, copied 26 Sep 2026.
// The real site will build all of this from Markdown files; the mockups only need enough to judge the look.
const IMG = 'https://jacklee981229.github.io/images';

window.MOCK = {
  site: {
    title: "Jack's Space",
    tagline: 'My programming journal',
    intro: 'Just sharing some of my thoughts, and maybe some tech that I learned. And some games to share :D',
    author: 'Jack Lee',
    role: 'Software developer in Malaysia',
    avatar: `${IMG}/avatar.png`,
    github: 'https://github.com/jacklee981229',
    email: 'mailto:jackjiunyihlee@gmail.com',
    started: '2023-02-23',
    visitors: 719,
    views: 1036,
    updated: '2023-10-16',
    license: 'CC BY-NC-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    tags: ['hexo', 'next', 'game', 'AI', 'git', 'flutter', 'script', 'Hexo', 'javascript', 'ChatGPT', 'chatgpt', 'butterfly'],
  },

  // Lane order for the commit graph, left to right.
  topics: [
    { id: 'hexo', name: 'Hexo' },
    { id: 'git', name: 'Git' },
    { id: 'chatgpt', name: 'ChatGPT' },
    { id: 'games', name: 'Games' },
    { id: 'flutter', name: 'Flutter' },
  ],

  // Newest first. Dates are Malaysia time (UTC+8).
  posts: [
    // Covers: the first image in each post, except Flutter, where the finished-app screenshot makes a better cover.
    { slug: '11', title: 'Flutter Get Started', date: '2023-10-16', updated: '2023-10-16', topic: 'flutter', tags: ['flutter'], views: 18,
      cover: { src: `${IMG}/flutter_first_app_showcase.png`, w: 1052, h: 2060 },
      excerpt: 'Here is some Flutter installation steps, as I feel that some part still missing in the official flutter documentation.' },
    { slug: '10', title: 'Terraria', date: '2023-10-05', updated: '2023-10-16', topic: 'games', tags: ['game'],
      cover: { src: `${IMG}/terraria.png`, w: 1920, h: 1200 },
      excerpt: 'For my whole life (25 years in exact) I don’t play a lot of games. During my teenager days I have played Dota, Dota 2, Counter-Strike, and basically that’s all.' },
    { slug: '9', title: 'Talk about Hexo Admin', date: '2023-10-04', updated: '2023-10-16', topic: 'hexo', tags: ['Hexo'],
      cover: { src: `${IMG}/hexo-admin.png`, w: 1200, h: 600 },
      excerpt: 'So I am a programmer. Fresh, 3 years working experience, only know about C# DotNet, WPF and related stuff.' },
    { slug: '8', title: 'Don’t Starve', date: '2023-10-04', updated: '2023-10-16', topic: 'games', tags: [],
      cover: { src: `${IMG}/dont-starve-together.png`, w: 2400, h: 1350 },
      excerpt: 'Well, technically the title should be ‘Don’t Starve Together’ - as this is the game that I owned.' },
    { slug: 'c2', title: 'ChatGPT - Useful Prompts', date: '2023-03-25', updated: '2023-10-16', topic: 'chatgpt', tags: ['chatgpt'],
      excerpt: 'ChatGPT some useful prompts! Create a 1-month study plan.' },
    { slug: '7', title: 'Theme Modification 1: Loading Screen', date: '2023-03-13', updated: '2023-10-16', topic: 'hexo', tags: [],
      excerpt: 'Prerequisite: Hexo and Butterfly theme. Modified fullpage-loading.pug under themes/butterfly/includes/loading.' },
    { slug: 'c1', title: 'ChatGPT extensions', date: '2023-03-11', updated: '2023-10-16', topic: 'chatgpt', tags: ['ChatGPT', 'AI'],
      cover: { src: `${IMG}/screenshots/chatGPT-extension-ss1.png`, w: 1912, h: 887 },
      excerpt: 'AIPRM for ChatGPT. This extension adds a list of curated prompt templates for you to ChatGPT.' },
    { slug: '6', title: 'Why I switch theme?', date: '2023-03-11', updated: '2023-10-16', topic: 'hexo', tags: ['hexo', 'next', 'butterfly'],
      excerpt: '2023-3-11, I switched my theme from Next to Butterfly.' },
    { slug: 'g1', title: 'Git Commands', date: '2023-03-10', updated: '2023-10-16', topic: 'git', tags: ['git'],
      excerpt: 'Init an empty repository. Add remote, using http or ssh method.' },
    { slug: '5', title: 'How to inject scripts in Hexo?', date: '2023-03-05', updated: '2023-10-16', topic: 'hexo', tags: ['hexo', 'next', 'script', 'javascript'],
      excerpt: 'Hexo reads scripts that are stored under a scripts folder in your root folder.' },
    { slug: '4', title: 'click-effect-tutorial', date: '2023-03-03', updated: '2023-10-16', topic: 'hexo', tags: [],
      excerpt: 'You can add some clicking effects in your Hexo project.' },
    { slug: '3', title: 'Sample Heart.js script', date: '2023-03-03', updated: '2023-10-16', topic: 'hexo', tags: ['script', 'javascript'],
      excerpt: '' },
    { slug: '2', title: 'Hexo Change Default to Page', date: '2023-03-02', updated: '2023-10-16', topic: 'hexo', tags: ['hexo'],
      excerpt: 'First we need understand how Hexo’s blog page works.' },
    { slug: '1', title: 'Hexo Documentation', date: '2023-03-02', updated: '2023-10-16', topic: 'hexo', tags: ['hexo', 'next'],
      excerpt: 'How to Hexo? Official Documentation.' },
  ],

  // Full text for the two sample posts.
  bodies: {
    '11': `
<p>Here is some Flutter installation steps, as I feel that some part still missing in the <a href="https://docs.flutter.dev/get-started/install/windows">official flutter documentation</a>.</p>
<h2 id="flutter-installation-steps">Flutter Installation Steps</h2>
<ol>
  <li><p>Get the Flutter SDK</p>
    <p>this steps is simple, download, placed somewhere. <a href="https://docs.flutter.dev/get-started/install/windows#get-the-flutter-sdk">link here</a></p>
    <p><img src="${IMG}/flutter_get_the_sdk.png" alt="flutter sdk" width="1008" height="431"></p></li>
  <li><p>Update your path <a href="https://docs.flutter.dev/get-started/install/windows#update-your-path">link here</a></p></li>
  <li><p>Run <code>flutter</code> to make sure if path is recognized in cmd</p></li>
  <li><p>Download and install Android Studio Giraffe</p>
    <p><a href="https://developer.android.com/studio">Android Studio Giraffe</a></p>
    <p>After installation, create a new project and ‘Run’. It will auto download and install neccessary components. An android emulator will be launch in the end.</p></li>
  <li><p>Run <code>flutter doctor</code> to check if Android Studio is there.</p>
    <p><img src="${IMG}/flutter_doctor_android_studio.png" alt="flutter doctor" width="295" height="25"></p>
    <p>If Flutter cannot locate it, run <code>flutter config --android-studio-dir=&lt;directory&gt;</code> to set the directory that Android Studio is installed to.</p></li>
  <li><p>Install command-line tool</p>
    <p>The easiest way is to follow <a href="https://stackoverflow.com/a/60529140">instruction</a> here:</p>
    <ol>
      <li>Open Android Studio</li>
      <li>Tools Menu, SDK Manager</li>
      <li>choose <strong>SDK Tools</strong> from inner panels<br><img src="${IMG}/android_studio_sdk_tools_panel.png" alt="sdk tool" width="630" height="368"></li>
      <li>Tick <strong>Android SDK Command-line Tools</strong> and click ‘apply’</li>
    </ol></li>
  <li><p>Run <code>flutter doctor --android-licenses</code> and it should works</p></li>
  <li><p>Run <code>flutter doctor</code> to see if any component missing</p></li>
  <li><p>Open up your VS Code editor and install Flutter extension</p>
    <p><img src="${IMG}/flutter_vs_extension.png" alt="vs code extension" width="260" height="152"></p>
    <blockquote><p>you may have to restart VS Code after installation</p></blockquote></li>
  <li><p>Run <code>flutter create {your_app_name}</code> to create your first project and opened it</p></li>
  <li><p>You shall see a Windows (windows-x64) tab at bottom right, click it</p>
    <p><img src="${IMG}/vscode_bottom_left_devices.png" alt="devices" width="703" height="110"></p></li>
  <li><p>A dialog will be prompt, you should see emulators, run it</p>
    <p><img src="${IMG}/vscode_popup_device.png" alt="vs code popup devices" width="626" height="206"></p></li>
  <li><p>After the emulator is ready, pressed ‘F5’ and your app shall build on the emulator. <em><strong>Whoorays!</strong></em></p></li>
</ol>
<p><img src="${IMG}/flutter_first_app_showcase.png" alt="flutter first app" width="1052" height="2060"></p>`,

    '2': `
<h2 id="concept">Concept</h2>
<ol start="0"><li>First we need understand how Hexo’s <strong>blog page</strong> works.</li></ol>
<ul>
  <li>By default, Hexo will create a <strong>blog page</strong> that will showcase all your posts. Refer to <a href="https://hexo.io/docs/configuration.html#Home-page-setting">this</a>.</li>
  <li>Hexo creates a <code>index.html</code>, which is your <strong>blog page</strong>, when deploy using <code>hexo d</code> or <code>hexo deploy</code>.</li>
  <li>This is all based on the pre-installed module <code>hexo-generator-index</code>, which you can config under <code>_config.yml</code> file:</li>
</ul>
<pre data-lang="yml">index_generator:
  path: ''
  per_page: 10
  order_by: -date</pre>
<ul><li>the value from <code>path</code> adds suffix to your website url.</li></ul>
<h3 id="custom-default-page">If you want to display your custom page by default instead of the “blog page”, follow steps below.</h3>
<ol><li>Deploy your <strong>blog page</strong> somewhere else.</li></ol>
<ul>
  <li>Go to file <code>_config.yml</code>, find these lines:
<pre data-lang="yml">index_generator:
  path: ''
  per_page: 10
  order_by: -date</pre></li>
  <li>Edit value in <code>path</code>, for example I change to follow:
<pre data-lang="yml">index_generator:
  path: 'blog'
  per_page: 10
  order_by: -date</pre>
    <ul>
      <li>This will create the <strong>blog page</strong> inside a <code>blog</code> directory, from <code>path: 'blog'</code>.</li>
      <li>Now if you want to access your <strong>blog page</strong>, just visit “<strong>your_website_url/blog/</strong>”. For example, my website is “<strong><a href="https://jacklee981229.github.io/">https://jacklee981229.github.io/</a></strong>”, the url to my <strong>blog page</strong> will be “<strong><a href="https://jacklee981229.github.io/blog/">https://jacklee981229.github.io/blog/</a></strong>”.</li>
    </ul></li>
  <li>After first step, you will get error when trying to accessing your website’s main url, as the <code>index.html</code> is not auto-generated anymore. Therefore you will need to create a <code>index.md</code> file under <code>source</code> folder manually.</li>
</ul>
<ol start="2"><li>Create your own default page.</li></ol>
<ul>
  <li>Create a <code>index.md</code> under source folder. Other naming will require additional works. So we are stick to <code>index.md</code> in this case.
    <ul><li>Type in <code>Hello World!</code> in your <code>index.md</code>.</li></ul></li>
  <li>You are all set! Run <code>hexo g</code> &amp;&amp; <code>hexo s</code> and you shall see your <code>Hello World!</code> message.</li>
</ul>
<ol start="3">
  <li>You can edit your <code>index.md</code> to show all your writings, all your posts and pages.</li>
  <li>Visit <a href="https://jacklee981229.github.io/">mine</a> for an idea!</li>
</ol>`,
  },
};
