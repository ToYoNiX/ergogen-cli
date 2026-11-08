const ergogen = require('../../src/ergogen')

// Two keys 19 apart, the second rotated 10 degrees around its center.
const config = {
    points: {
        zones: {
            matrix: {
                columns: {
                    left: {},
                    right: {key: {spread: 19, splay: 10}},
                },
                rows: {home: {}},
            },
        },
    },
    outlines: {
        plate: [
            {what: 'rectangle', where: true, size: 18},
            {what: 'rectangle', where: 'matrix_left_home', adjust: {shift: [0, -20]}, size: [30, 10]},
            {what: 'circle', where: 'matrix_left_home', radius: 2, operation: 'subtract'},
        ],
    },
}

// Numbers in SVG path data, as [x, y] pairs.
const pathPoints = d => {
    const numbers = (d.match(/-?\d+(\.\d+)?(e-?\d+)?/g) || []).map(Number)
    const pairs = []
    for (let i = 0; i + 1 < numbers.length; i += 2) pairs.push([numbers[i], numbers[i + 1]])
    return pairs
}

describe('Shapes', function() {

    it('are only reported when asked for', async function() {
        const results = await ergogen.process(config, {svg: true})
        expect(results.shapes).to.be.undefined
    })

    it('list every part of an outline, in config order, with each placement', async function() {
        const {shapes} = await ergogen.process(config, {svg: true, shapes: true})
        const plate = shapes.plate
        plate.parts.map(part => [part.name, part.what, part.operation]).should.deep.equal([
            ['0', 'rectangle', 'add'],
            ['1', 'rectangle', 'add'],
            ['2', 'circle', 'subtract'],
        ])

        // `where: true` places the first rectangle on both keys, rotated with them.
        const keys = plate.parts[0].placements
        keys.map(p => p.point).should.deep.equal(['matrix_left_home', 'matrix_right_home'])
        keys[0].x.should.equal(0)
        keys[0].y.should.equal(0)
        keys[0].r.should.equal(0)
        keys[1].x.should.equal(19)
        keys[1].r.should.equal(10)
        keys.every(p => p.mirrored === false).should.equal(true)

        // `adjust.shift` moves the placement away from its key.
        const shifted = plate.parts[1].placements
        shifted.should.have.length(1)
        shifted[0].y.should.equal(-20)

        // A part with no `where` sits at the origin, on no named point.
        const {shapes: unplaced} = await ergogen.process({
            points: config.points,
            outlines: {box: [{what: 'rectangle', size: 5}]},
        }, {shapes: true})
        expect(unplaced.box.parts[0].placements[0].point).to.equal(null)
    })

    it('give each placement its outline in the outline SVG\'s coordinates', async function() {
        const {shapes, outlines} = await ergogen.process(config, {svg: true, shapes: true})
        const plate = shapes.plate
        const [, , width, height] = outlines.plate.svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number)

        // The outline's extents are what the SVG's viewBox spans (which makerjs rounds to 3 decimals).
        plate.extents.high[0].should.be.closeTo(plate.extents.low[0] + width, 1e-3)
        plate.extents.high[1].should.be.closeTo(plate.extents.low[1] + height, 1e-3)

        // The 30 × 10 rectangle sits 20 below the left key: in SVG coordinates (y down) its points
        // span 30 wide and 10 high, below the key's square, and inside the drawing.
        const points = pathPoints(plate.parts[1].placements[0].path)
        const xs = points.map(p => p[0])
        const ys = points.map(p => p[1])
        ;(Math.max(...xs) - Math.min(...xs)).should.be.closeTo(30, 1e-6)
        ;(Math.max(...ys) - Math.min(...ys)).should.be.closeTo(10, 1e-6)
        const keyPoints = pathPoints(plate.parts[0].placements[0].path)
        Math.min(...ys).should.be.greaterThan(Math.max(...keyPoints.map(p => p[1])))
        for (const [x, y] of points) {
            x.should.be.within(-1e-3, width + 1e-3)
            y.should.be.within(-1e-3, height + 1e-3)
        }
    })
})
