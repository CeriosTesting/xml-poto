---
"@cerios/xml-poto": patch
---

Fix registry conflicts when multiple classes use the same @XmlElement name

**Problem:** When two different classes were decorated with the same `@XmlElement` name (e.g., `@XmlElement("security")`), they would compete for the same global registry entry. Whichever class was imported last would overwrite the first, causing deserialization to use the wrong class.

**Solution:** Implemented a context-aware element registration system that:
- Tracks elements within their parent class context when explicit types are provided
- Prevents registry collisions between classes with identical element names
- Maintains full backward compatibility with existing code
- Preserves auto-discovery functionality for classes without explicit types

**Impact:** Multiple classes can now safely use the same element name in different contexts without conflicts. All existing tests pass (1481/1481).
