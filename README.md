# ditched

Command line tool to find npm dependencies that have been ditched.
A ditched package is one that has not been updated in more than 90 days.

This is a fork of the abandoned project [abandoned](https://github.com/brendonboshell/abandoned).

![ditched usage](screenshot.png)

## How to Use

Within your project, run

```
npx ditched
```

You can also install it as a dev dependency and use it in your scripts,
for example as part of your build procedure or as a reminder after install.

```
npm install --dev ditched
```

package.json:

```
"scripts": {
  "test": "ditched",
  "postinstall": "ditched"
}
```

### Options

`--all`/`-a`: Include all dependencies in the resulting table, not only those that are ditched (updated > 90 days ago).
