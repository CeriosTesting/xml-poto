---
"@cerios/xml-poto": patch
---

Fix duplicate element name conflicts and strict validation behavior

## What Changed

### Strict Validation Fix
- Fixed strict validation mode to properly reject unmapped XML elements instead of falling back to auto-discovery
- In strict mode, elements must now be explicitly declared in the model to be considered valid
- Auto-discovery is now only used for elements that have explicit field mappings in the model

### Breaking Change Behavior
- When `strictValidation: true` is enabled, the deserializer will now correctly throw an error for:
  - Unexpected XML elements that don't match any declared field (even if a class exists in the global registry)
  - Missing expected elements when field names don't match the XML structure
