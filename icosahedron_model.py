def lerp(v1, v2, pct):
    return list(v1[i] + pct*(v2[i] - v1[i]) for i in xrange(3))

hubs = [
    (-102.337,  267.923, -177.254), #0
    (-102.337,  267.923,  177.254), #1
    ( 204.676,  267.923,     0.00), #2
    ( 165.586,   63.248, -286.803), #3
    (-165.586,  -63.248, -286.803), #4
    (-331.171,   63.249,     0.00), #5
    (-165.586,  -63.248,  286.803), #6
    ( 165.586,   63.248,  286.803), #7
    ( 331.171,  -63.249,     0.00), #8
    ( 102.337, -267.923, -177.254), #9
    (-204.676, -267.923,     0.00), #10
    ( 102.337, -267.923,  177.254), #11
]

# this is arbitrary (wrong) for now until I can get my hands on the artpiece
# just edges, not strips
green = [(0,1), (0, 3), (0,4), (1,7), (7,11), (4,9)]
purple = [(0,2), (0,5), (2,3), (3,8), (8,9), (9,11)]
red = [(3,4), (4,5), (3,9), (9,10), (5,10), (10,11)]
orange = [(5,1), (1,2), (2,7), (2,8), (7,8), (8,11)]
yellow = [(11,6), (6,7), (6,10), (6,1), (6,5), (10,4)]

strips = [[ #green
    ((11, 7), 6),
    (( 7, 1), 6),
    (( 1, 0), 2),
    (( 0, 3), 2),
    (( 3, 0), 4),
    (( 0, 4), 3),
    (( 4, 9), 3),
    (( 9, 4), 10),
    (( 4, 0), 5),
    (( 0, 1), 5),
    (( 1, 7), 2),
    (( 7,11), 8),
],
[ #purple,
    ((11, 9), 8),
    (( 9, 8), 11),
    (( 8, 3), 9),
    (( 3, 2), 8),
    (( 2, 0), 3),
    (( 0, 5), 4),
    (( 5, 0), 1),
    (( 0, 2), 1),
    (( 2, 3), 0),
    (( 3, 8), 2),
    (( 8, 9), 3),
    (( 9,11), 10),
],
[ #red
    ((11,10), 9),
    ((10, 9),11),
    (( 9,10), 4),
    ((10, 5), 6),
    (( 5, 4),10),
    (( 4, 3), 9),
    (( 3, 9), 4),
    (( 9, 3), 8),
    (( 3, 4), 0),
    (( 4, 5), 0),
    (( 5,10), 4),
    ((10,11), 6),
],
[ #orange
    ((11, 8), 7),
    (( 8, 2), 7),
    (( 2, 8), 3),
    (( 8, 7),11),
    (( 7, 2), 1),
    (( 2, 1), 0),
    (( 1, 5), 0),
    (( 5, 1), 6),
    (( 1, 2), 7),
    (( 2, 7), 8),
    (( 7, 8), 2),
    (( 8,11), 9),
],
[ #yellow
    ((11, 6), 10),
    (( 6,10),  5),
    ((10, 4),  5),
    (( 4,10),  9),
    ((10, 6), 11),
    (( 6, 5), 10),
    (( 5, 6),  1),
    (( 6, 1),  5),
    (( 1, 6),  7),
    (( 6, 7),  1),
    (( 7, 6), 11),
    (( 6,11),  7),
]
]

faces = [
    (0,1,2),
    (0,2,3),
    (0,3,4),
    (0,4,5),
    (0,5,1),

    (1,6,7),
    (1,2,7),
    (2,7,8),
    (2,3,8),
    (3,8,9),
    (3,4,9),
    (4,9,10),
    (4,5,10),
    (5,6,10),
    (5,6,1),

    (6,7,11),
    (7,8,11),
    (8,9,11),
    (9,10,11),
    (10,6,11),
]

edges = [
    ( 0, 1), ( 0, 2), ( 0, 3), ( 0, 4), ( 0, 5),
    ( 1, 2), ( 2, 3), ( 3, 4), ( 4, 5), ( 5, 1),
    ( 1, 6), ( 1, 7), ( 2, 7), ( 2, 8), ( 3, 8), ( 3, 9), ( 4, 9), ( 4,10), ( 5,10), ( 5, 6),
    ( 6, 7), ( 7, 8), ( 8, 9), ( 9,10), (10, 6),
    ( 6,11), ( 7,11), ( 8,11), ( 9,11), (10,11),
]

def centroid(v1, v2, v3):
    return tuple((v1[i] + v2[i] + v3[i])/3 for i in xrange(3))

def scale(v1, v2, v3):
    c = centroid(v1, v2, v3)
    v1n = tuple(c[i] + (v1[i]-c[i])*0.9 for i in xrange(3))
    v2n = tuple(c[i] + (v2[i]-c[i])*0.9 for i in xrange(3))
    v3n = tuple(c[i] + (v3[i]-c[i])*0.9 for i in xrange(3))

    return v1n, v2n, v3n

pixels = []
num_pixels = 0

for strip in strips:
    pixel_strip = list()
    for (a, b), c in strip:
        va, vb, _ = scale(hubs[a], hubs[b], hubs[c])
        for p in xrange(1, 16):
            pixel_strip.append(lerp(va, vb, p / 16.0))
    num_pixels += len(pixel_strip)
    pixels.append(list(pixel_strip))

data = {
    'num_pixels': num_pixels,
    'strips': pixels,
}
import json
print "icosahedron_data ='%s'" % (json.dumps(data),)
