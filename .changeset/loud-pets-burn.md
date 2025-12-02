---
"@cerios/xml-poto": patch
---

Performance improvements: Replaced Object.keys/entries/values with for-in/for-of loops throughout hot paths to eliminate intermediate array allocations. Optimized metadata destructuring and reduced duplicate lookups in serialization/deserialization.
