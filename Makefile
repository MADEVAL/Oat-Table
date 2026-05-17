# oat-table - Build System

.PHONY: dist test check clean

dist:
	@node scripts/build.js

test:
	@node --test tests/*.test.js

check: dist test

clean:
	@node scripts/clean.js