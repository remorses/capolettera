## pixi react

read this repo files to see how to use pixi react 

https://github.com/pixijs/pixi-react

https://github.com/pixijs/pixi-layout


top level imports to use 

```ts
import '@pixi/layout' // Import layout before PixiJS to ensure mixins are applied
import '@pixi/react';
import '@pixi/layout/react';

import { LayoutContainer } from '@pixi/layout/components'
import { Application, extend } from '@pixi/react'
import { Container, Graphics, Text } from 'pixi.js'



// Extend @pixi/react with PIXI components
extend({ Container, Graphics, Text, LayoutContainer })

```

## pixi solid

see https://github.com/sammccord/solid-pixi
