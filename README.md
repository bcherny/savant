![savant](https://raw.githubusercontent.com/bcherny/savant/master/savant.png)

> A designer-friendly way to generate icon fonts from a folder of SVG icons

![][bower] [![npm]](https://www.npmjs.com/package/savant)

[bower]: https://img.shields.io/bower/v/savant.svg?style=flat-square
[npm]: https://img.shields.io/npm/v/savant.svg?style=flat-square

## installation

```bash
# with npm:
npm install -g savant

# or, with bower:
bower install savant
```

## usage

Put your SVG icons in a folder, give them dash-cased names, and prefix them with the unicode charcode you want assigned to them.

For example, let's say you have 3 icons in a folder called "src" (`0061` is the [unicode character](http://en.wikipedia.org/wiki/List_of_Unicode_characters) for the letter `a`, `0062` is `b`, and `0063` is, you guessed it, `c`):

![](http://i.imgur.com/HQYRybl.png)

Run `savant -i src -o dist`, which generates a `dist/` folder for you, containing your new web-friendly icon font:

![](http://i.imgur.com/GifqI7G.png)

- **my-font.eot**, **my-font.svg**, **my-font.ttf**, and **my-font.woff** is your icon font, in 4 formats for [compatibility](http://caniuse.com/#feat=fontface) with every major browser
- **my-font.css** and **my-font.scss** is the stylesheet for your font, in 2 formats depending on how you want to consume it 
- **my-font-spec.html** is a spec file and m**y-font-spec.png** is a screenshot of it, with every icon in your font neatly laid out for you (hover over an icon to see its CSS class):

![](http://i.imgur.com/hfvknW6.png)

### CLI usage

```bash
savant --in [input_dir] --out [output_dir] --name [font_name] --prefix [prefix]

# eg.
savant --in src/ --out dist/ --name my-font --prefix abc

# basic usage
savant -i src -o dist
```

`in` and `out` are required, while `name` and `prefix` are optional

### Programmatic usage

`savant#compile` returns a promise:

```js
#!/usr/bin/env node

require('savant')
.compile({
  input_dir: './src',
  output_dir: './dist'
})
.then(function () {
  console.log('success!')
})
.catch(function (err) {
  console.log('error!', err)
})
.finally(function () {
  console.log('done!')
})
```

## q&a

**How does savant know what to name my font?**

If you pass a name in via the CLI or programmatic interface, savant will use that.
If you run the `savant` command from a folder that contains a package.json, and that package.json has a `name` field, savant will fall back to that.
Otherwise, savant will fall back to the name of the folder that you ran the `savant` command from.

**How does savant know how to prefix my font's CSS classes?**

If you pass a prefix in via the CLI or programmatic interface, savant will use that.
Otherwise, savant will compute a prefix based on your font name (eg. "my-awesome-font" will become "maf")

## todo

- tests

## based on

https://github.com/bcherny/svg-font-create