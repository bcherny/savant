Full rewrite of https://github.com/bcherny/svg-font-create

Coming soon...

## Programmatic usage

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