媒介モデルの推定結果（図はファイル `figures/model.dot` から描画）．本文コードブロックからの Graphviz 描画も検証する．

```dot
digraph mini {
  rankdir=LR;
  node [shape=ellipse, fontsize=12];
  X [label="プライム"];
  M [label="潜在的態度"];
  Y [label="意図"];
  X -> M -> Y;
}
```
