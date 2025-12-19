---
"@cerios/xml-poto": patch
---

Ensures attribute and field element metadata is registered at class definition time for classes decorated with @xmlelement (not just @xmlRoot). Previously, metadata registration could be delayed until instance creation, causing validation and serialization issues.

Processes pending attribute and field element metadata from decorator context and registers them immediately when the class decorator executes. This guarantees metadata availability before any instances are created.

Additionally improves error messaging by adding guidance about avoiding circular dependencies when reusing namespace constants across multiple files.
