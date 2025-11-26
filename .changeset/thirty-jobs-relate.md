---
"@cerios/xml-poto": patch
---

Renamed @XmlArrayItem decorator to @XmlArray for better clarity and consistency. The old @XmlArrayItem decorator is now deprecated but still functional for backward compatibility. Added support for undecorated classes within @XmlArray elements. Arrays can now contain plain classes without requiring decorators on every element.
