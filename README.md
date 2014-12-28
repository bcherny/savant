# savant

> A designer-friendly way to generate icon fonts from a folder of SVG icons

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

- my-font.eot, my-font.svg, my-font.ttf, and my-font.woff is your icon font, in 4 formats for [compatibility](http://caniuse.com/#feat=fontface) with every major browser
- my-font.css and my-font.scss is the stylesheet for your font, in 2 formats depending on how you want to consume it 
- my-font-spec.html is a spec file and my-font-spec.png is a screenshot of it, with every icon in your font neatly laid out for you (hover over an icon to see its CSS class):

![](http://i.imgur.com/hfvknW6.png)

### CLI usage

```bash
savant inputDir outputDir

# eg.
savant --in src/ --out dist/
```

### Programmatic usage

```js
#!/usr/bin/env node

require('svgs-to-fonts')
.compile({
  input_dir: './src',
  output_dir: './dist'
})
.then(function () {
  console.log('done!')
})
```

## based on

https://github.com/bcherny/svg-font-create