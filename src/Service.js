import _ from 'lodash';

/**
 * Check and convert includes to chain of 'populate'
 * item.populate('..').populate('..')....
 */
function __populateIncludes(query, relations, include) {
    _.each(include || [], inc => {
        const rel = relations[inc];

        if (rel) {
            if (rel === 'populate') {
                query = query.populate(inc);
            } else if (_.isObject(rel)) {
                query = query.populate(rel);
            } else {
                throw (`<${inc}> definition is broken`);
            }
        }
    });

    return query;
}

/**
 * copy named relations and apply transform
 */
function __includePostprocessing(result, relations, include) {
    _.each(include || [], inc => {
        const rel = relations[inc];
        if (rel && (typeof rel !== 'string')) {
            result[inc] = rel.transform ? rel.transform(result[rel.path]) : result[rel.path];
        }
    });

    return result;
}

export default class Service {
    constructor(item) {
        Object.assign(this, item);
    }

    static async find(filter = {}, include = []) {
        if (this.beforeFind) await this.beforeFind(filter, include);
        let self = this;
        const { where = {}, skip, limit, sort } = filter;

        let items = self.model.find(where);
        if (sort) items.sort(sort);
        if (skip) items.skip(+skip);
        if (limit) items.limit(+limit); // limit || 25

        items = __populateIncludes(items, self.relations, include);
        items = await items.exec();

        let res = _.map(items, item => __includePostprocessing(
            new self( item.toObject() ),
            self.relations,
            include
        ));

        if (this.afterFind) await this.afterFind(res);
        return res;
    }

    static async count(filter = {}) {
        if (this.beforeFind) await this.beforeFind(filter, include);
        const { where = {}, skip, limit } = filter;

        let count = this.model.countDocuments(where);
        if (skip) count.skip(+skip);
        if (limit) count.limit(+limit); // limit || 25
        count = await count.exec();

        return count;
    }

    static async findByIdAndDelete(id, options = {}) {
        if (this.beforeDelete) await this.beforeDelete(id);
        const res = await this.model.findByIdAndDelete(id, options);

        if (this.afterDelete) await this.afterDelete({ _id: id }, res ? [ res ] : []);

        return res;
    }

    static async findByIdAndUpdate(id, data = {}, options = {}) {
        if (this.beforeEdit) data = await this.beforeEdit(id, data, options);
        const res = await this.model.findByIdAndUpdate(id, data, options);
        if (this.afterEdit) await this.afterEdit(id, res);

        return res;
    }

    static async findOne(filter = {}, include = []) {
        if (this.beforeFind) await this.beforeFind(filter, include);
        let self = this;
        
        let item = self.model.findOne(filter);
        item = __populateIncludes(item, self.relations, include);
        item = await item.exec();

        // if the request did not find anything, return null and do not continue processing
        if (!item) return null;

        let res = __includePostprocessing(
            new self( item.toObject() ),
            self.relations,
            include
        );

        if (this.afterFind) await this.afterFind(res);
        return res;
    }

    static async findById(id, include=[]) {
        let self = this;
        
        let item = self.model.findById(id);
        item = __populateIncludes(item, self.relations, include);
        item = await item.exec();
        
        // if the request did not find anything, return null and do not continue processing
        if (!item) return null;

        return __includePostprocessing(
            new self( item.toObject() ),
            self.relations,
            include
        );
    }

    static async findOneAndDelete(filter = {}, options = {}) {
        if (this.beforeDelete) await this.beforeDelete(filter, options);
        const res = await this.model.findOneAndDelete(filter, options);

        if (this.afterDelete) await this.afterDelete(filter, res ? [ res ] : []);

        return res;
    }

    static async findOneAndUpdate(filter = {}, data={}, options = {}) {
        if (this.beforeEdit) data = await this.beforeEdit(filter, data, options);
        const res = await this.model.findOneAndUpdate(filter, data, options);
        if (this.afterEdit) await this.afterEdit(filter, res);

        return res;
    }

    static async findOneAndReplace(filter = {}, data={}, options = {}) {
        if (this.beforeEdit) data = await this.beforeEdit(filter, data, options);
        const res = await this.model.findOneAndReplace(filter, data, options);
        if (this.afterEdit) await this.afterEdit(filter, res);

        return res;
    }
    
    static async create(data, options = {}) {
        if (this.beforeCreate) data = await this.beforeCreate(data);
        
        let item;
        try {
            item = await this.model.create(data, options);
        } catch (e) {
            console.log("class (line : 147) | create | e : ", e);
            throw e;
        }

        if (_.isArray(item)) {
            item = item.map((oneItem) => new this(oneItem.toObject()));
        } else {
            item = new this(item.toObject());
        }

        if (this.afterCreate) await this.afterCreate(data, item);

        return item;
    }

    static async exists(filter) {
        if (this.beforeFind) await this.beforeFind(filter, include);
        return this.model.exists(filter);
    }

    static async deleteMany(filter = {}, options = {}) {
        if (this.beforeDelete) await this.beforeDelete(filter, options);

        let res = [];
        if (this.afterDelete) {
            res = await this.model.find(filter);

            await this.model.deleteMany(filter, options);
            await this.afterDelete(filter, res);
        } else {
            res = await this.model.deleteMany(filter, options);
        }

        return res;
    }

    static async deleteOne(filter = {}, options = {}) {
        if (this.beforeDelete) await this.beforeDelete(filter, options);

        const res = await this.model.deleteOne(filter, options);

        if (this.afterDelete) await this.afterDelete(filter, res ? [ res ] : res);
        return res;
    }

    static async updateMany(filter = {}, data, options) {
        if (this.beforeEdit) data = await this.beforeEdit(filter, data, options);
        if (!data) return { nModified: 0};

        const res = await this.model.updateMany(filter, data, options);
        if (this.afterEdit) await this.afterEdit(filter, res);

        return res;
    }

    async save(options) {
        return this.constructor.model.findByIdAndUpdate(this._id, this, options);
    }

    async delete(options) {
        return this.constructor.model.findByIdAndDelete(this._id, options);
    }
}