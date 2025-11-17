const AddCollider = pc.createScript('add-collider');

AddCollider.prototype.initialize = function() {
    this.entity.findComponents('render').forEach((render) => {
        const entity = render.entity;
        entity.addComponent('rigidbody', {
            type: 'static'
        });
        entity.addComponent('collision', {
            type: 'mesh',
            renderAsset: render.asset
        });
    });
};