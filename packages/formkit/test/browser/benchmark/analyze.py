import argparse
import collections
import itertools
import json
import math
import statistics

ARMS = ('marionette', 'vue', 'react')
METRICS = ('mountDomMs', 'mountSettledMs', 'firstCaptureToCommitMs',
           'warmCaptureToCommitMs', 'lateCaptureToCommitMs', 'teardownMs')


def summarize(rows):
    cases = collections.defaultdict(lambda: collections.defaultdict(list))
    for row in rows:
        if not row.get('warmup'):
            cases[row['shape'], row['fields']][row['block']].append(row)
    out = []
    for (shape, fields), blocks in sorted(cases.items()):
        valid, rejected, orders = [], [], []
        for block, samples in sorted(blocks.items()):
            order = tuple(x['arm'] for x in samples)
            if (len(order) != len(ARMS) or set(order) != set(ARMS)
                    or any(not x.get('correct') or x.get('error') for x in samples)
                    or any(not isinstance(s.get(m), (int, float))
                           or isinstance(s[m], bool) or not math.isfinite(s[m])
                           or s[m] < 0 for s in samples for m in METRICS)):
                rejected.append(block)
                continue
            orders.append(order)
            valid.append({s['arm']: s for s in samples})
        balanced = collections.Counter(orders) == collections.Counter(itertools.permutations(ARMS))
        pairs = {}
        for peer in ARMS[1:]:
            pairs[peer] = {}
            for m in METRICS:
                delta = [s['marionette'][m] - s[peer][m] for s in valid]
                pairs[peer][m] = None if not delta else {
                    'medianMs': statistics.median(delta),
                    'rangeMs': [min(delta), max(delta)],
                    'marionetteFasterOutOf': [sum(d < 0 for d in delta), len(delta)],
                }
        out.append({'shape': shape, 'fields': fields, 'n': len(valid),
                    'balanced': balanced, 'rejected': rejected, 'deltas': pairs})
    return out


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('file')
    args = parser.parse_args()
    with open(args.file, encoding='utf-8') as f:
        print(json.dumps(summarize(json.load(f)), indent=2))
