---
title: Git Commands
tags:
  - blog
date: 2023-03-10 09:39:26
id: blog_7
description: some git commands.
---

- Init an empty repository.

```bash
git init
```

- add remote, using `http` or `ssh` method
- *origin* is just a naming for your remote

```bash
git remote add *origin* {url}
```

- fetch all from remote

```bash
git fetch --all
```

- reset everything to your online repository
- *--hard* will delete all your local changes!

```bash
git reset --hard *origin*/{branch_name}
```

- show list of branches

```bash
git branch
```

- switch or create branch

```bash
git checkout {branch_name} 
```

- pull from remote, might need to fix commits

```bash
git pull
```

- rebase, add in changes and align with commit dates

```bash
git pull --rebase
```

- merge, add a merge commit message to show all the changes

```bash
git pull --merge
```

- stage all your changes, *add .* is stage all changes, you can add specific if needed

```bash
git add .
```

- commit your staged changes

```bash
git commit -m "{commit_message}" 
```

- push your commits to online repo

```bash
git push origin {branch_name}
```

> I actually prefer using git client such as [Fork](https://git-fork.com/), so you can get rid of all these commands