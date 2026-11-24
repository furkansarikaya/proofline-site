%%% reference-safe
See [the guide][g] and [shortcut] and [collapsed][].

[g]: https://example.com/guide
[shortcut]: ../other.md
[collapsed]: #top
%%% reference-unsafe
See [the guide][g].

[g]: javascript:alert(1)
%%% angle-autolinks
<https://example.com/> and <javascript:alert(1)> and <path:line>
%%% literals
www.example.com and https://example.com and a@example.com
%%% footnote
Text with a note.[^1]

[^1]: The note text.
%%% task-list
- [x] done item
- [ ] open item
%%% right-aligned-table
| Name | Count |
| ---- | ----: |
| a | 1 |
%%% fence-info
```js" onmouseover=alert(1)
code
```
%%% link-title
[a](https://example.com/ "javascript:alert(1)")
%%% image-in-link
[![alt text](https://example.com/a.png)](https://example.com/)
%%% image-empty-alt
![](https://example.com/a.png)
%%% heading-html
# Title <span>x</span>
%%% html-in-label
[<img src=x onerror=alert(1)>](https://example.com/)
%%% html-in-cell-and-item
| a |
| - |
| <i>b</i> |

- <b>c</b>
%%% comment-then-text
<!-- c --> trailing text
