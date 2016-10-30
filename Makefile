clean:
	-find . -name '*.swp' -print0| xargs -0 rm
	-find . -name '*un~' -print0| xargs -0 rm
