Solar.OrbitList = (function(){

    function nextItem(list) {
        var i = list.distanceIndex.indexOf(list.currentEntry);
        if ( i < list.distanceIndex.length - 1) {
            list.currentEntry = list.distanceIndex[i+1];
        }
        return list.currentEntry.item;
    }

    function previousItem(list) {
        var i = list.distanceIndex.indexOf(list.currentEntry);
        if ( i > 0 ) {
            list.currentEntry = list.distanceIndex[i-1];
        }
        return list.currentEntry.item;
    }

    function distanceSort(a,b) {
        return a.distance - b.distance;
    }

    function length(items) {
        return items.length;
    }

    function getItem(items, i) {
        return items[i];
    }

    function addItem(list, newItem, items) {
        var distance = new THREE.Vector3().copy(list.centerItem.position).sub(newItem.position).lengthSq();
        if ( newItem != list.centerItem ) {
            items.push(newItem);
        }
        var entry  = {
            item: newItem,
            distance: distance
        }

        list.distanceIndex.push(entry);
        list.distanceIndex.sort(distanceSort)

        return entry;
    }

    function initList(item){
        var items = [];
        var list = {
            centerItem: item,
            distanceIndex: [],
            addItem: function(newItem){ return addItem(list, newItem, items) },
            nextItem: function() {return nextItem(list); },
            previousItem: function() {return previousItem(list); },
            currentEntry: null,
            length: function(){return length(items);},
            getItem: function(i){return getItem(items,i);}
        };
        list.currentEntry = list.addItem(item);
        return list;
    }
    return {
        initList: initList
    }
})();
