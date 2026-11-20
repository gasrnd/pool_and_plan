#!/usr/bin/env python3
"""Builds index.html (the website) from src/app.html.
src/app.html is the app as a page body (it also runs as a Claude artifact).
The website version gets a full HTML document and loads todoist-mapping.js, which turns on the Todoist connection."""
import os
here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'src', 'app.html'), encoding='utf-8').read()
i = src.index('</style>') + len('</style>')
head, body = src[:i], src[i:]
head = head.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
reset = (':root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
         'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}')
out = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
       '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
       '<style>' + reset + '</style>\n' + head.strip() + '\n<script src="todoist-mapping.js"></script>\n</head>\n<body>'
       + body.rstrip() + '\n</body>\n</html>\n')
open(os.path.join(here, 'index.html'), 'w', encoding='utf-8').write(out)
print('index.html', len(out), 'bytes')
