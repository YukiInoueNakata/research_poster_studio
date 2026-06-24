# Fix overflow

When the warning log reports an `overflow` for a block:

1. Open the block's `content/*.md`.
2. Shorten redundant text first (merge sentences, cut filler, use lists).
3. If space remains in the column, raise the block height
   (`height.min`, switch to `flex` with higher `weight`, or set a larger
   `fixed` value).
4. Only then reduce `style.body_font_size`, never below 18pt (A0).
5. If it still overflows, move the block to `column: wide` or rebalance the
   `layout.columns.ratio`.

Never auto-shrink below the readable minimum. Report each change and why.
