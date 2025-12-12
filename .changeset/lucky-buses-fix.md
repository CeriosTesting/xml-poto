---
"@cerios/xml-poto": patch
---

Excludes properties decorated with @XmlDynamic from strict validation checks since they intentionally contain plain objects with dynamic content. Also skips validation for unmapped XML elements on classes using @XmlDynamic, allowing XBRL-style dynamic content to work correctly without throwing false positive validation errors.
