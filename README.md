A better way to define schemas for your JSON.

## Introduction

If you want to take the system for a spin, please go to <https://reproto.github.io>.

Reproto is:

* **A compiler** capable of generating code for various languages.<br />
  [try it out][trycompiler] &ndash; [documentation][langsupport]
* **A custom interface description language** that permits describing the schema of JSON and
  services in a concise, easy to understand way.<br />
  [documentation][idl]
* **Early and extensive soundness checking**, with excellent error handling. We catch schema issues
  before you know that you have them.<br />
  [ui tests][ui-tests]
* **A derive command**, capable of deriving schemas directly from JSON.<br />
  [try it out][tryderive] &ndash; [documentation][derive].
* **A semantic version checker** which verifies that modifications to schemas do not violate
  [semantic versioning].<br />
  [documentation][semver]
* **A build system with a package manager using build manifests**, giving you all the control you
  need to integrate reproto into your project.<br />
  [documentation][build manifests]
* **A rich, markdown-based documentation generator**.<br />

These things combined support an ecosystem where schemas can be maintained and shared across
many teams.

**Note:** This project is in an early stage. Things will change a lot. Please take it for a spin,
but avoid building large repositories of schemas for now.

[idl]: https://github.com/reproto/reproto/tree/master/doc/spec.md
[derive]: https://github.com/reproto/reproto/tree/master/doc/derive.md
[langsupport]: https://github.com/reproto/reproto/tree/master/doc/usage/language-support.md
[semver]: https://github.com/reproto/reproto/tree/master/doc/semck.md
[semantic versioning]: https://semver.org
[central repository]: https://github.com/reproto/reproto-index
[build manifests]: https://github.com/reproto/reproto/tree/master/doc/manifest.md
[stdweb]: https://github.com/koute/stdweb
[trycompiler]: https://reproto.github.io/?input=reproto&output=java&package=example.type
[tryderive]: https://reproto.github.io/?input=json&output=java&package=example.type
[ui-tests]: https://github.com/reproto/reproto/tree/master/it/ui/checks

## Getting Started

* See the [documentation] for an overview of how the reproto language and its build manifest works.
* See [examples] for some example specifications and projects.
* See the [integration tests] for even more examples on how protocol specifications can be used.
* See [release notes] for past and coming changes.

[documentation]: https://github.com/reproto/reproto/tree/master/doc/README.md
[examples]: https://github.com/reproto/reproto/tree/master/examples
[integration tests]: https://github.com/reproto/reproto/tree/master/it
[release notes]: https://github.com/reproto/reproto/tree/master/RELEASES.md

## License

Copyright John-John Tedro
Licensed under the MIT license (see LICENSE.txt)
