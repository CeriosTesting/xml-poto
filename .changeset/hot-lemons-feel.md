---
"@cerios/xml-poto": major
---

**BREAKING CHANGE: Enhanced @XmlComment decorator with targetProperty and multi-line support**
This is a breaking change as `targetProperty` is now required on the `@XmlComment` decorator. The `@XmlComment` decorator has been significantly improved with better positioning control and multi-line comment support.

## Breaking Changes

### targetProperty is now required

Previously, `@XmlComment` could be used without specifying which element it comments