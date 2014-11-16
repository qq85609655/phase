var editors = {
};
var SchemaEditor, CubeEditor,
    SharedDimensionEditor, PrivateDimensionEditor, DimensionUsageEditor,
    HierarchyEditor, LevelEditor, MeasureEditor
;

(function(){

var fields = {
  name: {
    labelText: "Name",
    dataPath: ["modelElement", "attributes", "name"],
    mandatory: true,
    tooltipText: "Name of this item. This is the name that will be used to identify this item in MDX queries."
  },
  caption: {
    labelText: "Caption",
    dataPath: ["modelElement", "attributes", "caption"],
    tooltipText: "A human-friendly label to identify this item in graphical user interfaces."
  },
  description: {
    labelText: "Description",
    tagName: "textarea",
    dataPath: ["modelElement", "attributes", "description"],
    tooltipText: "A human readable description for this item."
  },
  visible: {
    inputType: "checkbox",
    labelText: "Visible",
    dataPath: ["modelElement", "attributes", "visible"],
    defaultValue: true,
    tooltipText: "Should this item be visible?"
  },
  cache: {
    inputType: "checkbox",
    labelText: "Cache",
    dataPath: ["modelElement", "attributes", "cache"],
    defaultValue: true,
    tooltipText: "Should values for this item be cached?"
  },
  enabled: {
    inputType: "checkbox",
    labelText: "Enabled",
    dataPath: ["modelElement", "attributes", "enabled"],
    defaultValue: true,
    tooltipText: "Should this item be available to the user?"
  },
  highCardinality: {
    inputType: "checkbox",
    labelText: "High Cardinality",
    dataPath: ["modelElement", "attributes", "highCardinality"],
    tooltipText: "Are there many values associated with this item?"
  },
  usagePrefix: {
    labelText: "Usage Prefix",
    dataPath: ["modelElement", "attributes", "usagePrefix"],
    tooltipText: "If present, then this is prepended to the Dimension column names during the building of collapse dimension aggregates allowing 1) different dimension usages to be disambiguated during aggregate table recognition and 2) multiple shared dimensions that have common column names to be disambiguated."
  },
  foreignKey: {
    labelText: "Foreign key",
    tagName: "select",
    dataPath: ["modelElement", "attributes", "foreignKey"],
    tooltipText: "The foreign key in the fact table to which this item is bound."
  },
  dimensionType: {
    labelText: "Dimension type",
    tagName: "select",
    dataPath: ["modelElement", "attributes", "type"],
    defaultValue: "StandardDimension",
    options: [
      {labelText: "Standard", value: "StandardDimension"},
      {labelText: "Date", value: "TimeDimension"}
    ],
    tooltipText: "The type of this dimension."
  },
  datatype: {
    tagName: "select",
    labelText: "Data Type",
    dataPath: ["modelElement", "attributes", "datatype"],
    options: ["", "Boolean", "Date", "Integer", "Numeric", "String", "Time", "Timestamp"],
    defaultValue: "",
    tooltipText: "The datatype of this item."
  },
  formatString: {
    labelText: "Format",
    dataPath: ["modelElement", "attributes", "formatString"],
    tooltipText: "Format string with which to format values of this item."
  },
  format: {
    labelText: "Format",
    tooltipText: "How to format values for this item.",
    choose: {
      namedFormat: {
        dataPath: ["modelElement", "attributes", "formatString"],
        options: ["", "Currency", "Fixed", "General Date", "General Number", "Long Date", "Long Time", "Medium Date", "Medium Time", "Short Date", "Short Time", "On/Off", "Percent", "Scientific", "Standard", "True/False", "Yes/No"],
        defaultValue: ""
      },
      formatString: {
        dataPath: ["modelElement", "attributes", "formatString"],
        defaultValue: ""
      },
      expression: {
        dataPath: ["modelElement", "childNodes", "CalculatedMemberProperty[@name='FORMAT_STRING']", "attributes", "expression"],
        defaultValue: ""
      }
    }
  }
};

var GenericEditor;
(GenericEditor = function(conf){
  if (!conf) {
    conf = {};
  }
  if (!conf.classes) {
    conf.classes = [];
  }
  if (!conf.tabs) {
    conf.tabs = [{
      text: "General",
      selected: true,
      component: cEl("div")
    }, {
      text: "Annotations",
      component: cEl("div")
    }];
  }
  this.dialog = conf.dialog || new Dialog();
  this.tabPane = new TabPane({
    listeners: {
      scope: this,
      beforeSelectTab: this.beforeSelectTab,
      tabSelected: this.tabSelected
    }
  });

  this.mondrianSchemaCache = conf.mondrianSchemaCache;
  this.mondrianSchemaCache.listen({
    modelEvent: function(mondrianSchemaCache, event, data){
      var model = this.model;
      if (data.model !== model) {
        return;
      }
      var eventData = data.eventData;
      eventData.isDescendant = model.isModelElementPathAncestor(this.modelElementPath, eventData.modelElementPath);
      this.handleModelEvent(data.modelEvent, eventData);
    },
    modelElementRenamed: function(mondrianSchemaCache, event, data){
      var model = this.model;
      if (data.model !== model) {
        return;
      }
      var eventData = data.eventData;
      if (this.modelElement !== eventData.modelElement) {
        return;
      }
      var modelElementPath = this.modelElementPath;
      this.modelElementPath[modelElementPath.type] = eventData.newValue;
    },
    scope: this
  });

  if (conf.listeners) {
    this.listen(conf.listeners);
  }

  this.pedisCache = conf.pedisCache;

  conf.classes.push("phase-editor");
  arguments.callee._super.apply(this, arguments);
}).prototype = {
  fields: {},
  getRelationInfo: function(relation, callback, scope){
    var pedisCache = this.pedisCache;
    var dataSourceName = this.model.getDataSourceName();
    if (!dataSourceName) {
      return;
    }
    var table = {
      TABLE_CAT: null,
      TABLE_SCHEM: relation.attributes.schema || null,
      TABLE_NAME: relation.attributes.name
    };
    var alias = relation.attributes.alias;
    var me = this;
    pedisCache.getTableInfo(dataSourceName, table, function(tableInfo){
      if (alias) {
        table.alias = alias;
      }
      table.info = tableInfo;
      callback.call(scope || null, table);
    }, this);
  },
  getHierarchyRelations: function(){
    var model = this.model, modelElement = this.modelElement;
    var relations = [], relationships = [], relationship;
    var ret = {
      relations: relations,
      relationships: relationships
    }
    var relation = model.getHierarchyRelation(this.modelElementPath);
    if (!relation) {
      return ret;
    }
    relations.push(relation);
    var i = 0, left, right;
    while (i < relations.length) {
      relation = relations[i++];
      if (relation.tagName === "Join"){
        relationship = {
          join: relation
        };
        left = model.getRelation(relation, 0);
        if (left) {
          relationship.left = {
            index: relations.length,
            relation: left
          }
          relations.push(left);
        }
        right = model.getRelation(relation, 1);
        if (right) {
          relationship.right = {
            index: relations.length,
            relation: right
          }
          relations.push(right);
        }
        relationships.push(relationship);
      }
    }
    return ret;
  },
  populateSelectFieldWithHierarchyRelations: function(fieldName){
    this.clearSelectField(fieldName);
    var relationsInfo = this.getHierarchyRelations();
    var relations = relationsInfo.relations;
    var relation, options = [""];
    var i, n = relations.length;
    for (i = 0; i < n; i++){
      relation = relations[i];
      switch (relation.tagName) {
        case "Table":
          break;
        default:
          continue;
      }
      options.push(relation.attributes.alias || relation.attributes.name);
    }
    this.populateSelectField(fieldName, options);
  },
  populateSelectFieldWithHierarchyRelationColumns: function(tableField, columnField, callback, scope){
    this.clearSelectField(columnField);
    var tableName = this.getFieldValue(tableField);
    var relationsInfo = this.getHierarchyRelations();
    var i, relations = relationsInfo.relations, n = relations.length, relation;
    for (i = 0; i < n; i++) {
      relation = relations[i];
      if (
        relation.attributes.alias && relation.attributes.alias === tableName ||
        relation.attributes.name && relation.attributes.name === tableName
      ) {
        break;
      }
      relation = null;
    }
    if (!relation) {
      return;
    }
    this.getRelationInfo(relation, function(table){
      var options = [""], info = table.info, columns = info.columns, column, i, n = columns.length;
      for (i = 0; i < n; i++) {
        column = columns[i];
        options.push(column.COLUMN_NAME);
      }
      this.populateSelectField(columnField, options);
      if (callback) {
        callback.call(scope || null, tableField, columnField);
      }
      else {
        this.setSelectFieldValue(columnField, this.modelElement.attributes[columnField]);
      }
    }, this);
  },
  getCubeRelationAnnotationPrefix: function(cubeRelation){
    return "phase.Table." + (cubeRelation.attributes.alias || cubeRelation.attributes.name) + ".";
  },
  getCubeRelationInfo: function(callback, scope){
    var model = this.model, modelElement = this.modelElement;
    var relation = model.getCubeRelation(this.modelElementPath);
    if (!relation) {
      callback.call(scope || null, null);
      return;
    }
    if (relation.tagName !== "Table") {
      throw "Fact relations of type " + relation.tagName + " are currently not supported.";
    }
    this.getRelationInfo(relation, function(table){
      var annotationPrefix = this.getCubeRelationAnnotationPrefix(relation);
      var rec = {
        metadata: table,
      };
      var x = model.getAnnotationValue(modelElement, annotationPrefix + "x");
      if (x) {
        rec.x = x;
      }
      var y = model.getAnnotationValue(modelElement, annotationPrefix + "y");
      if (y) {
        rec.y = y;
      }
      if (table.alias) {
        rec.alias = table.alias;
      }
      callback.call(scope || null, rec);
    }, this);
  },
  beforeSelectTab: function(tabPane, event, data){
    var oldTab = data.oldTab;
    var oldTab = tabPane.getTab(oldTab);
    if (oldTab && (oldTab.component === this.diagram)) {
      this.saveDiagram();
    }
  },
  tabSelected: function(tabPane, event, data){
    //noop
  },
  handleModelEvent:function(event, data){
    //noop.
  },
  getFields: function(){
    var myFields = this.fields;
    return myFields;
  },
  getFieldDefinition: function(field) {
    return this.getFields()[field];
  },
  forEachField: function(callback, scope, includeColumnSeparators){
    var field, fields = this.getFields(), fieldDef;
    if (!scope) {
      scope = this;
    }
    for (field in fields) {
      fieldDef = fields[field];
      if (/_column\d+/.test(field) && fieldDef === null && includeColumnSeparators !== true) {
        continue;
      }
      if (callback.call(scope, field, fieldDef) === false) {
        return false;
      }
    }
    return true;
  },
  createField: function(fieldset, key, definition, tabIndex) {
    var children = [], mandatoryClass;
    if (key && definition) {
      var id = this.getFieldId(key);
      children.push(
        cEl("label", {
          "for": id
        }, definition.labelText || key)
      );

      var inputConf = {
        "id": id,
        "name": key,
        "type": definition.inputType || "text",
        tabindex: tabIndex
      };

      if (definition.mandatory === true) {
        inputConf.required = true;
      }
      var input = cEl(definition.tagName || "input", inputConf);
      if (definition.options) {
        if (definition.tagName === "select") {
          var i, option, optionDefinition, options = definition.options, n = options.length;
          for (i = 0; i < n; i++){
            optionDefinition = options[i];
            if (iStr(optionDefinition)) {
              optionDefinition = {
                labelText: optionDefinition,
                value: optionDefinition
              }
            }
            cEl("option", {
              label: optionDefinition.labelText || "",
              value: optionDefinition.value || ""
            }, optionDefinition.labelText || optionDefinition.value, input);
          }
        }
      }
      children.push(input);

      if (definition.tooltipText) {
        var indent = String.fromCharCode(160);
        indent += indent + indent + indent + indent + indent + indent;
        children.push(
          cEl("span", {
              "class": "hint-icon",
            },
            [indent, cEl("div", {
              "class": "tooltip"
            }, definition.tooltipText)]
          )
        );
      }

      mandatoryClass = definition.mandatory === true ? " mandatory" : "";
    }
    var pureClasses = "pure-control-group";
    if (this.columnCount > 1) {
      pureClasses += " pure-u-1 pure-u-md-1-" + this.columnCount;
    }

    var item = cEl("div", {
      "class": pureClasses + (mandatoryClass ? mandatoryClass : "")
    }, children, fieldset);
    this.fieldCreated(fieldset, key, definition, tabIndex);
    return item;
  },
  fieldCreated: function(fieldset, key, definition, tabIndex){
    //noop
  },
  fieldUpdated: function(fieldName, value){
    //noop
  },
  getFormId: function(){
    return this.getId() + "-form";
  },
  getFieldId: function(key){
    return this.getId() + "-field-" + key;
  },
  getFieldElement: function(key){
    return gEl(this.getFieldId(key));
  },
  createForm: function(dom, fields){
    var fieldsetChildren = [cEl("legend")];
    var grid;

    var fieldColumn = [], fieldColumns = [fieldColumn], numFields, maxNumFields = 0;
    this.forEachField(function(field, fieldDef){
      if (/_column\d+/.test(field) && fieldDef === null) {
        numFields = fieldColumn.length;
        if (numFields > maxNumFields) {
          maxNumFields = numFields;
        }
        fieldColumn = [];
        fieldColumns.push(fieldColumn);
      }
      else {
        fieldColumn.push({
          field: field,
          fieldDef: fieldDef
        });
      }
    }, this, true);
    if (maxNumFields < fieldColumn.length) {
      maxNumFields = fieldColumn.length;
    }
    this.columnCount = fieldColumns.length;

    if (this.columnCount > 1) {
      grid = cEl("div", {
        "class": "pure-g"
      });
      fieldsetChildren.push(grid);
    }
    var fieldset = cEl("fieldset", null, fieldsetChildren);
    var form = cEl("form", {
      "class": "pure-form pure-form-aligned",
      id: this.getId() + "-form"
    }, [fieldset], dom);
    this.form = form;

    var x, y, field, fieldDef, tabIndex;
    for (y = 0; y < maxNumFields; y++) {
      for (x = 0; x < this.columnCount; x++) {
        fieldColumn = fieldColumns[x];
        if (y < fieldColumn.length) {
          this.createField(
            grid || fieldset,
            fieldColumn[y].field,
            fieldColumn[y].fieldDef,
            1 + y + (x * maxNumFields)
          );
        }
        else {
          this.createField(grid || fieldset);
        }
      }
    }
  },
  createDom: function(){
    var dom = GenericEditor._super.prototype.createDom.apply(this, arguments);
    var toolbar = this.toolbar;
    if (toolbar) {
      var me = this;
      toolbar.listen({
        "buttonPressed": function(toolbar, event, button){
          var conf = button.conf;
          if (conf.handler) {
            conf.handler.call(conf.scope || me);
          }
        }
      });
    }
    this.tabPane.conf.container = dom;
    this.tabPane.addTab(this.conf.tabs)
    this.createForm(this.tabPane.getTabPage(0), this.getFields());
    return dom;
  },
  getModel: function(){
    return this.model;
  },
  setModel: function(model){
    if (this.model === model) {
      return;
    }
    this.model = model;
    //TODO: update all the fields that list items from the model
  },
  getModelElementPath: function(){
    return merge({}, this.modelElementPath);
  },
  getModelElement: function(){
    return this.modelElement;
  },
  setModelElement: function(modelElementPath){
    this.modelElementPath = modelElementPath;
    if (this.model === null) {
      this.modelElement = null;
    }
    else
    if (this.modelElementPath === null) {
      this.modelElement = null;
    }
    else {
      this.modelElement = this.model.getModelElement(modelElementPath);
    }
  },
  setSelectFieldValue: function(fieldName, value){
    var fieldEl = this.getFieldElement(fieldName);
    var option, options = fieldEl.options, i, n = options.length;
    for (i = 0; i < n; i++) {
      option = options[i];
      if (option.value !== value) {
        continue;
      }
      fieldEl.selectedIndex = i;
      return true;
    }
    return false;
  },
  updateFieldValue: function(field, fieldDef) {
    if (!fieldDef) {
      fieldDef = this.getFields()[field];
    }
    var path = fieldDef.dataPath;
    if (!path) return;
    var data = this[path[0]];
    var i, n = path.length, pathItem;
    for (i = 1; i < n; i++){
      if (data === null || iUnd(data)) {
        break;
      }
      pathItem = path[i];
      data = data[pathItem];
    }
    var fieldEl = this.getFieldElement(field);
    if (data === null || iUnd(data)) {
      data = fieldDef.defaultValue || "";
    }
    switch (fieldDef.tagName) {
      case "select":
        this.setSelectFieldValue(field, data);
        break;
      default:
        switch (fieldEl.type) {
          case "checkbox":
            fieldEl.checked = String(data) === "true";
            break;
          default:
            fieldEl.value = data;
        }
    }
    this.fieldUpdated(field, data);
  },
  updateFieldValues: function(){
    if (!this.form) {
      return;
    }
    this.forEachField(function(field, fieldDef){
      this.updateFieldValue(field, fieldDef);
    });
    //focus the first control on the form.
    //since the fieldset counts as a control, the index is 1 not 0.
    var element = this.form.elements[1];
    try {
      element.focus();
    } catch(exception) {
      //noop. Sometimes can't get focus on IE,
    }
    if (iFun(element.select)) {
      element.select();
    }
  },
  getFieldValue: function(field) {
    var fieldEl = this.getFieldElement(field);
    var fieldDef = this.getFieldDefinition(field);
    var value;
    switch (fieldEl.tagName.toLowerCase()) {
      case "select":
        if (fieldEl.selectedIndex === -1) {
          value = undefined;
        }
        else {
          value = fieldEl.options[fieldEl.selectedIndex].value;
        }
        break;
      case "input":
        switch (fieldEl.type) {
          case "text":
            value = fieldEl.value;
            break;
          case "checkbox":
            value = fieldEl.checked;
            break;
        }
      case "textarea":
        value = fieldEl.value;
        break;
        break;
      default:
        throw "Unknown field type"
    }
    if ((value === "") ||
        (fieldDef.defaultValue && (fieldDef.defaultValue === value))
    ) {
      value = undefined;
    }
    return value;
  },
  saveFieldValues: function(){
    var model = this.model;
    var modelElementPath = this.modelElementPath;
    if (!model || !this.modelElement || !modelElementPath) {
      return;
    }
    if (!model.getModelElement(modelElementPath)) {
      //this.modelElement = null;
      return;
    }
    var success = true;
    this.forEachField(function(field, fieldDef){
      var value = this.getFieldValue(field);
      var path = fieldDef.dataPath;
      if (!path) return;
      if ((path.length === 3) &&
          (path[0] === "modelElement") &&
          (path[1] === "attributes")
      ) {
        var attribute = path[2], result;
        result = this.model.setAttributeValue(
          modelElementPath,
          attribute,
          value
        );
        if (result === false) {
          success = false;
        }
      }
      else {
        var data = this[path[0]];
        var i, n = path.length - 1, pathItem = null;
        for (i = 1; i < n; i++){
          pathItem = path[i];
          data = data[pathItem];
        }
        var key = path[path.length-1];
        if (iUnd(value) || (value === "") || (fieldDef.defaultValue && (fieldDef.defaultValue === value))) {
          delete data[key];
        }
        else {
          data[key] = value;
        }
      }
    }, this);
    if (success === false) {
      //if we some fields were prevented from being saved,
      //we reset the fields with the current state in the model.
      this.updateFieldValues();
    }
    if (this.diagramActivated()) {
      this.saveDiagram();
    }
    this.fieldValuesSaved();
    return success;
  },
  fieldValuesSaved: function(){
    //noop. override
  },
  modelChanged: function(){
    //noop. Override.
  },
  modelElementChanged: function(){
    //noop. Override.
  },
  setData: function(model, modelElementPath){
    var oldModel = this.model;
    var oldModelElementPath = this.modelElementPath;
    if (oldModel instanceof MondrianModel &&
      (oldModel !== model || oldModelElementPath !== modelElementPath)
    ) {
//      this.saveFieldValues();
    }
    this.setModel(model);
    this.setModelElement(modelElementPath);
    if (oldModel !== model) {
      this.modelChanged();
      this.modelElementChanged();
    }
    else
    if (model.getModelElement(oldModelElementPath) !== model.getModelElement(modelElementPath)) {
      this.modelElementChanged();
    }
    this.updateFieldValues();
    this.diagramNeedsUpdate = true;
    //this.updateDiagramIfDisplayed();
  },
  clearSelectField: function(fieldName) {
    var fieldEl = this.getFieldElement(fieldName);
    while (fieldEl.options.length) {
      fieldEl.removeChild(fieldEl.options[fieldEl.options.length -1]);
    }
  },
  populateSelectField: function(fieldName, options){
    options.sort(function(a, b) {
      a = a.toLowerCase();
      b = b.toLowerCase();
      var r;
      if (a < b) {
        r = -1;
      }
      else
      if (a > b) {
        r = 1;
      }
      else {
        r = 0;
      }
      return r;
    });
    var fieldElement = this.getFieldElement(fieldName);
    var n = options.length, option, i;
    for (i = 0; i < n; i++) {
      option = options[i];
      cEl("option", {
        label: option,
        value: option,
      }, option, fieldElement);
    }
  },
  getDiagram: function(){
    return this.diagram;
  },
  saveDiagram: function(){
  },
  diagramActivated: function(){
    var diagram = this.getDiagram();
    if (!diagram) {
      return false;
    }
    var selectedTab = this.tabPane.getSelectedTab();
    if (!selectedTab) {
      return false;
    }
    return selectedTab.component === diagram;
  },
  updateDiagramIfDisplayed: function(){
    if (this.diagramNeedsUpdate !== true) {
      return;
    }
    if (!this.diagramActivated()) {
      return;
    }
    this.updateDiagram();
  },
  updateDiagram: function(){
  }
};
adopt(GenericEditor, ContentPane, Displayed, Observable);

(SchemaEditor = function(conf){
  linkCss("../css/phase-schema-editor.css");
  if (!conf) {
    conf = {};
  }
  if (!conf.classes) {
    conf.classes = [];
  }
  conf.classes.push("phase-schema-editor");

  if (!conf.toolbar) {
    conf.toolbar = {};
  }
  if (!conf.toolbar.buttons) {
    conf.toolbar.buttons = [
      {"class": "new-cube", tooltip: "New Cube", handler: function(){
        this.createNewCube();
      }},
      {"class": "new-dimension", tooltip: "New Shared Dimension", handler: function(){
        this.createNewSharedDimension();
      }}
    ];
  }

  if (!conf.tabs) {
    conf.tabs = [{
      text: "General",
      selected: true,
      component: cEl("div")
    }, {
      text: "Annotations",
      component: cEl("div")
    }, {
      text: "Source",
      component: cEl("div")
    }];
  }

  arguments.callee._super.apply(this, [conf]);
}).prototype = {
  objectType: "Schema",
  fields: {
    dataSource: {
      tagName: "select",
      labelText: "Datasource",
      mandatory: true,
      tooltipText: "Name of the JDBC datasource to use as backend.",
      dataPath: ["model", "datasourceInfo", "DataSource"],
      addValue: true
    },
    enableXmla: {
      inputType: "checkbox",
      labelText: "Enable XML/A",
      mandatory: true,
      defaultValue: true,
      tooltipText: "Enable XML/A access to this schema?",
      dataPath: ["model", "datasourceInfo", "EnableXmla"]
    },
    name: fields.name,
    description: fields.description,
    measuresCaption: {
      labelText: "Measures Caption",
      dataPath: ["modelElement", "attributes", "measuresCaption"],
      tooltipText: "The human-friendly label used to identify the measures in graphical user interfaces.",
      defaultValue: "Measures"
    },
    defaultRole: {
      tagName: "select",
      labelText: "Default Role",
      dataPath: ["modelElement", "attributes", "defaultRole"],
      tooltipText: "The name of the default role for connections to this schema."
    }
  },
  getSourceTextAreaId: function(){
    return this.getId() + "-textarea";
  },
  createDom: function(){
    var dom = SchemaEditor._super.prototype.createDom.apply(this, arguments);
    var sourceTab = this.tabPane.getTab(2);

    var textArea = cEl("textarea", {
      id: this.getSourceTextAreaId()
    }, null, sourceTab.component);

    return dom;
  },
  createCodeMirror: function(){

    var values = {
      bool: ["true", "false"],
      type: ["String", "Numeric", "Integer", "Boolean", "Date", "Time", "Timestamp"]
    };

    var tags = {
      "!top": ["Schema"],
      "!attrs": {},
      Schema: {
        attrs: {
          name: null,
          description: null,
          measuresCaption: null,
          defaultRole: null
        },
        children: ["Annotations", "Parameter", "Dimension", "Cube", "VirtualCube", "NamedSet", "Role", "UserDefinedFunction"]
      },
      Annotations: {
        attrs: {},
        children: ["Annotation"]
      },
      Annotation: {
        attrs: {name: null}
      },
      Parameter: {
        attrs: {
          name: null,
          description: null,
          type: values.type.concat(["Member"]),
          modifiable: values.bool,
          defaultValue: null
        }
      },
      Dimension: {
        attrs: {
          type: ["StandardDimension", "TimeDimension"],
          usagePrefix: null,
          visible: values.bool,
          foreignKey: null,
          highCardinality: values.bool,
          name: null,
          caption: null,
          description: null
        },
        children: ["Annotations", "Hierarchy"]
      },
      Cube: {
        attrs: {
          name: null,
          caption: null,
          visible: values.bool,
          description: null,
          defaultMeasure: null,
          cache: values.bool,
          enabled: values.bool
        },
        children: ["Annotations", "Table", "View", "Dimension", "DimensionUsage", "Measure", "CalculatedMember", "NamedSet"]
      },
      DimensionUsage: {
        attrs: {
          source: null,
          level: null,
          usagePrefix: null,
          name: null,
          caption: null,
          visible: values.bool,
          description: null,
          foreignKey: null,
          highCardinality: values.bool
        }
      },
      Hierarchy: {
        attrs: {
          name: null,
          visible: values.bool,
          hasAll: values.bool,
          allMemberName: null,
          allMemberCaption: null,
          allLevelName: null,
          primaryKey: null,
          primaryKeyTable: null,
          defaultMember: null,
          memberReaderClass: null,
          caption: null,
          description: null,
          uniqueKeyLevelName: null
        },
        children: ["Annotations", "Table", "View", "Join", "InlineTable", "Level", "MemberReaderParameter"]
      },
      Level: {
        attrs: {
          approxRowCount: null,
          name: null,
          visible: values.bool,
          table: null,
          column: null,
          nameColumn: null,
          ordinalColumn: null,
          parentColumn: null,
          nullParentValue: null,
          type: values.type,
          internalType: ["int", "long", "Object", "String"],
          uniqueMembers: values.bool,
          levelType: ["Regular", "TimeYears", "TimeHalfYears", "TimeHalfYear", "TimeQuarters", "TimeMonths", "TimeWeeks", "TimeDays", "TimeHours", "TimeMinutes", "TimeSeconds", "TimeUndefined"],
          hideMemberIf: ["Never", "IfBlankName", "IfParentsName"],
          formatter: null,
          caption: null,
          description: null,
          captionColumn: null
        },
        children: ["Annotations", "KeyExpression", "NameExpression", "CaptionExpression", "OrdinalExpression", "ParentExpression", "MemberFormatter", "Closure", "Property"]
      },
      Closure: {
        attrs: {
          parentColumn: null,
          childColumn: null
        }
      },
      Property: {
        attrs: {
          name: null,
          column: null,
          type: values.type,
          formatter: null,
          caption: null,
          description: null,
          dependsOnLevelValue: values.bool
        },
        children: ["PropertyFormatter"]
      },
      Measure: {
        attrs: {
          name: null,
          column: null,
          datatype: values.type,
          formatString: null,
          aggregator: [ "sum", "count", "min", "max", "avg", "distinct-count"],
          formatter: null,
          caption: null,
          description: null,
          visible: values.bool
        },
        children: ["Annotations", "MeasureExpression", "CellFormatter", "CalculatedMemberProperty"]
      },
      CalculatedMember: {
        attrs: {
          name: null,
          formatString: null,
          caption: null,
          description: null,
          formula: null,
          dimension: null,
          hierarchy: null,
          parent: null,
          visible: values.bool
        },
        children: ["Annotations", "Formula", "CellFormatter", "CalculatedMemberProperty"]
      },
      CalculatedMemberProperty: {
        attrs: {
          name: null,
          caption: null,
          description: null,
          expression: null,
          value: null
        }
      },
      NamedSet: {
        attrs: {
          name: null,
          caption: null,
          description: null,
          formula: null
        },
        children: ["Annotations", "Formula"]
      },
      View: {
        attrs: {
          alias: null
        },
        children: ["SQL"]
      },
      Join: {
        attrs: {
          leftAlias: null,
          leftKey: null,
          rightAlias: null,
          rightKey: null
        },
        children: ["View", "Table", "Join", "InlineTable"]
      },
      Table: {
        attrs: {
          name: null,
          schema: null,
          alias: null
        },
        children: ["SQL", "AggExclude", "AggTable", "Hint"]
      },
      SQL: {
        attrs: {
          dialect: ["generic", "access", "db2", "derby", "firebird", "hsqldb", "mssql", "mysql", "oracle", "postgres", "sybase", "teradata", "ingres", "infobright", "luciddb", "vertica", "neoview"]
        }
      }
    };

    function completeAfter(cm, pred) {
      var cur = cm.getCursor();
      if (!pred || pred()) setTimeout(function() {
        if (!cm.state.completionActive)
          cm.showHint({completeSingle: false});
      }, 100);
      return CodeMirror.Pass;
    }

    function completeIfAfterLt(cm) {
      return completeAfter(cm, function() {
        var cur = cm.getCursor();
        return cm.getRange(CodeMirror.Pos(cur.line, cur.ch - 1), cur) == "<";
      });
    }

    function completeIfInTag(cm) {
      return completeAfter(cm, function() {
        var tok = cm.getTokenAt(cm.getCursor());
        if (tok.type == "string" && (!/['"]/.test(tok.string.charAt(tok.string.length - 1)) || tok.string.length == 1)) return false;
        var inner = CodeMirror.innerMode(cm.getMode(), tok.state).state;
        return inner.tagName;
      });
    }

    this.codeMirror = CodeMirror.fromTextArea(gEl(this.getSourceTextAreaId()), {
      mode: "application/xml",
      lineNumbers: true,
      foldGutter: true,
      gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
      indentUnit: 2,
      smartIndent: true,
      extraKeys: {
        "'<'": completeAfter,
        "'/'": completeIfAfterLt,
        "' '": completeIfInTag,
        "'='": completeIfInTag,
        "Ctrl-Space": "autocomplete"
      },
      hintOptions: {schemaInfo: tags}
    });
  },
  afterSetDisplayed: function(displayed){
    if (displayed) {
      this.refreshCodeMirror();
    }
  },
  refreshCodeMirror: function(){
    var codeMirror = this.codeMirror;
    if (!codeMirror) {
      return;
    }
    var tab = this.tabPane.getSelectedTab();
    if (tab.text !== "Source") {
      return;
    }
    window.setTimeout(function(){
      codeMirror.setSize(
        tab.component.clientWidth,
        tab.component.clientHeight - 30
      );
      codeMirror.refresh();
    }, 200);
  },
  initSourceCodeEditor: function(){
    if (!this.codeMirror) {
      this.createCodeMirror();
    }
    var value;
    if (this.model) {
      value = this.model.toXml();
    }
    else {
      value = "";
    }
    var codeMirror = this.codeMirror;
    codeMirror.getDoc().setValue(value);
    codeMirror.focus();
    this.refreshCodeMirror();
  },
  handleModelEvent: function(event, data){

    if (event === "modelDirty"){
      if (!this.codeMirror) {
        return;
      }
      this.initSourceCodeEditor();
    }
  },
  modelChanged: function(){
    if (!this.codeMirror) {
      return;
    }
    this.initSourceCodeEditor();
  },
  tabSelected: function(tabPane, event, data){
    switch (data.newTab) {
      case 2:
        this.initSourceCodeEditor();
        break;
    }
  },
  createNewCube: function(){
    var cube = this.model.createCube();
    var modelElementPath = merge({
      type: "Cube",
      Cube: cube.attributes.name
    }, this.modelElementPath);
    this.fireEvent("editorCreateAction", {
      model: this.model,
      modelElementPath: modelElementPath
    });
  },
  createNewSharedDimension: function(){
    var model = this.model;
    var dimension = model.createSharedDimension();

    //decorate the new dimension with a new hierarchy
    var dimensionName = dimension.attributes.name;
    var hierarchy = model.createSharedDimensionHierarchy(
      dimensionName, null, true
    );
    var hierarchyName = hierarchy.attributes.name;
    var level = model.createSharedDimensionLevel(
      dimensionName, hierarchyName, null, true
    );
    //end decoration

    var modelElementPath = merge({
      type: "SharedDimension",
      SharedDimension: dimension.attributes.name
    }, this.modelElementPath);
    this.fireEvent("editorCreateAction", {
      model: model,
      modelElementPath: modelElementPath
    });
  },
  fieldCreated: function(fieldset, key, definition, tabIndex){
    switch (key) {
      case "dataSource":
        this.populateDataSourceList();
        listen(this.getFieldElement(key), "change", function(){
          this.pedisCache.setConnection(this.getFieldValue("dataSource"));
        }, this);
        break;
    }
  },
  populateDataSourceList: function(){
    var me = this;
    this.pedisCache.loadConnections({
      success: function(data){
        var i, n = data.length, item, names = [""];
        for (i = 0; i < n; i++) {
          item = data[i];
          names.push(item.name);
        }
        var fieldName = "dataSource";
        me.populateSelectField(fieldName, names);
        me.updateFieldValue(fieldName);
      }
    });
  }
};
adopt(SchemaEditor, GenericEditor);

(CubeEditor = function(conf){
  linkCss("../css/phase-cube-editor.css");
  if (!conf) {
    conf = {};
  }
  if (!conf.classes) {
    conf.classes = [];
  }
  conf.classes.push("phase-cube-editor");

  this.diagram = new CubeDiagram({
    pedisCache: conf.pedisCache,
    dnd: conf.dnd,
    classes: ["phase-cube-diagram"],
    listeners: {
      scope: this,
      editDiagramElement: function(diagram, event, data){
        this.fireEvent(event, data);
      },
      removeDiagramElement: function(diagram, event, data){
        var objectType = data.objectType;
        var object = data.object;
        var modelElementPath = {
          Schema: this.model.getSchemaName(),
          Cube: this.getCubeName()
        };
        switch (objectType){
          case "privatedimension":
            modelElementPath.type = "PrivateDimension";
            modelElementPath[modelElementPath.type] = object.dimension.attributes.name;
            break;
          case "dimensionusage":
            modelElementPath.type = "DimensionUsage";
            modelElementPath[modelElementPath.type] = object.dimension.attributes.name;
            break;
          case "measure":
            modelElementPath.type = "Measure";
            modelElementPath[modelElementPath.type] = object.measure.attributes.name;
            break;
          case "relation":
            modelElementPath.type = "Table";
            modelElementPath[modelElementPath.type] = object.metadata.alias || object.metadata.TABLE_NAME;
            break;
          default:
            return;
        }
        this.model.removeModelElement(modelElementPath);
      },
      changeName: function(diagram, event, data){
      },
      nameChanged: function(diagram, event, data){
        var modelElementPath = merge({}, this.modelElementPath);
        switch (data.objectType) {
          case "dimensionusage":
            modelElementPath.type = "DimensionUsage";
            modelElementPath[modelElementPath.type] = data.object.dimension.attributes.name;
            this.model.setAttributeValue(modelElementPath, "name", data.newValue);
            break;
          case "privatedimension":
            modelElementPath.type = "PrivateDimension";
            modelElementPath[modelElementPath.type] = data.object.dimension.attributes.name;
            this.model.setAttributeValue(modelElementPath, "name", data.newValue);
            break;
          case "shareddimension":
            this.model.changeSharedDimensionName(
              data.object.dimension.attributes.name,
              data.newValue
            );
            break;
          case "measure":
            modelElementPath.type = "Measure";
            modelElementPath[modelElementPath.type] = data.object.measure.attributes.name;
            this.model.setAttributeValue(modelElementPath, "name", data.newValue);
            break;
          case "relation":
            break;
          default:
        }
      },
      aggregatorChanged: function(diagram, event, data){
        var modelElementPath = merge({}, this.modelElementPath);
        switch (data.objectType) {
          case "measure":
            modelElementPath.type = "Measure";
            modelElementPath[modelElementPath.type] = data.object.measure.attributes.name;
            this.model.setAttributeValue(modelElementPath, "aggregator", data.newValue);
            break;
          default:
        }
      },
      createTable: function(diagram, event, conf) {
        var relation = this.model.getCubeRelation(this.modelElementPath);
        if (relation) {
          this.dialog.show({
            message:  "Currently only one fact table is supported. " +
                      "Replace the current fact table?",
            title:    "Replace fact table?",
            yes:      {
                        handler: function(){

                        },
                        scope: this
                      },
            no:       {}
          });
          return;
        }
        this.createCubeRelation(conf);
      },
      createMeasure: function(diagram, event, conf){
        this.createNewMeasure(conf);
      }
    }
  });

  if (!conf.tabs) {
    conf.tabs = [{
      text: "General",
      selected: true,
      component: cEl("div")
    }, {
      text: "Diagram",
      component: this.diagram
    }, {
      text: "Annotations",
      component: cEl("div")
    }];
  }

  if (!conf.toolbar) {
    conf.toolbar = {};
  }
  if (!conf.toolbar.buttons) {
    conf.toolbar.buttons = [
      {
        "class": "new-measure",
        tooltip: "New Measure",
        handler: function(){
          this.createNewMeasure();
        }
      },
      {
        "class": "new-calculated-member",
        tooltip: "New Calculated Member",
        handler: function(){
          this.createNewCalculatedMember();
        }
      },
      {
        "class": "new-dimension",
        tooltip: "New Private Dimension",
        handler: function(){
          this.createNewPrivateDimension();
        }
      },
      {
        "class": "new-dimension-usage",
        tooltip: "New Dimension Usage",
        handler: function(){
          this.createNewDimensionUsage();
        }
      }
    ];
  }
  arguments.callee._super.apply(this, [conf]);
}).prototype = {
  objectType: "Cube",
  fields: {
    name: fields.name,
    caption: fields.caption,
    defaultMeasure: {
      tagName: "select",
      labelText: "Default Measure",
      dataPath: ["modelElement", "attributes", "defaultMeasure"],
      tooltipText: "The name of the measure that would be taken as the default measure of the cube.",
      addValue: true
    },
    visible: fields.visible,
    enabled: fields.enabled,
    cache: fields.cache,
    description: fields.description
  },
  handleModelEvent: function(event, data){
    switch (data.modelElementPath.type) {
      case "Measure":
        this.updateDefaultMeasuresField();
        break;
      case "Table":
        if (event === "modelElementCreated") {
          var modelElement = data.modelElement;
          var attributes = modelElement.attributes;
          var annotationPrefix = this.getCubeTableAnnotationPrefix(attributes.alias, attributes.name);
          var x = parseInt(this.model.getAnnotationValue(this.modelElement, annotationPrefix + "x"), 10);
          var y = parseInt(this.model.getAnnotationValue(this.modelElement, annotationPrefix + "y"), 10);
          data.x = x;
          data.y = y;
        }
        break;
    }
    switch (event) {
      case "modelElementCreated":
      case "modelElementRemoved":
        if (this.diagramActivated()) {
          //this.diagram.handleModelEvent(event, data);
          this.updateDiagram();
        }
        else {
          this.diagramNeedsUpdate = true;
        }
        break;
      default:
    }
  },
  updateDefaultMeasuresField: function(){
    var fieldName = "defaultMeasure";
    var cube = this.modelElement;
    var options = [""];
    this.model.eachMeasure(cube, function(measure){
      options.push(measure.attributes.name);
    });
    this.clearSelectField(fieldName);
    this.populateSelectField(fieldName, options);
  },
  getCubeName: function(){
    return this.modelElement.attributes.name;
  },
  getSharedDimensionAnnotationPrefix: function(sharedDimension){
    return "phase.sharedDimension." + sharedDimension.attributes.name + ".";
  },
  getCubeDimensionAnnotationPrefix: function(cubeDimension) {
    return "phase.";
  },
  addSharedDimensionToDiagram: function(sharedDimension){
    var annotationPrefix = this.getSharedDimensionAnnotationPrefix(sharedDimension);
    var rec = {
      dimension: sharedDimension
    };
    var cube = this.modelElement;
    var x = this.model.getAnnotationValue(cube, annotationPrefix + "x");
    if (x) {
      rec.x = x;
    }
    var y = this.model.getAnnotationValue(cube, annotationPrefix + "y");
    if (y) {
      rec.y = y;
    }
    this.diagram.addSharedDimension(rec);
  },
  addCubeDimensionToDiagram: function(cubeDimension){
    var annotationPrefix = this.getCubeDimensionAnnotationPrefix(cubeDimension);
    var rec = {
      dimension: cubeDimension
    };
    var x = this.model.getAnnotationValue(cubeDimension, annotationPrefix + "x");
    if (x) {
      rec.x = x;
    }
    var y = this.model.getAnnotationValue(cubeDimension, annotationPrefix + "y");
    if (y) {
      rec.y = y;
    }
    this.diagram.addCubeDimension(rec);
  },
  addDimensionUsageToDiagram: function(dimensionUsage){
    var sharedDimensionName = dimensionUsage.attributes.source;
    var diagram = this.getDiagram();
    if (!diagram.hasSharedDimension(sharedDimensionName)) {
      var model = this.model;
      var sharedDimension = model.getSharedDimension(sharedDimensionName);
      if (sharedDimension) {
        this.addSharedDimensionToDiagram(sharedDimension);
      }
    }
    this.addCubeDimensionToDiagram(dimensionUsage);
  },
  addDimensionUsagesToDiagram: function(){
    var model = this.model;
    var cubeName = this.getCubeName();
    model.eachDimensionUsage(cubeName, function(dimensionUsage, index){
      this.addDimensionUsageToDiagram(dimensionUsage);
    }, this);
  },
  addPrivateDimensionsToDiagram: function(){
    var model = this.model;
    var cubeName = this.getCubeName();
    model.eachPrivateDimension(cubeName, function(privateDimension, index){
      this.addCubeDimensionToDiagram(privateDimension);
    }, this);
  },
  addCubeDimensionsToDiagram: function(){
    this.addDimensionUsagesToDiagram();
    this.addPrivateDimensionsToDiagram();
  },
  getMeasureAnnotationPrefix: function(measure) {
    return "phase.";
  },
  addMeasureToDiagram: function(measure){
    var annotationPrefix = this.getMeasureAnnotationPrefix(measure);
    var rec = {
      measure: measure
    };
    var x = this.model.getAnnotationValue(measure, annotationPrefix + "x");
    if (x) {
      rec.x = x;
    }
    var y = this.model.getAnnotationValue(measure, annotationPrefix + "y");
    if (y) {
      rec.y = y;
    }
    this.diagram.addMeasure(rec);
  },
  addMeasuresToDiagram: function(){
    var model = this.model;
    var cubeName = this.getCubeName();
    model.eachMeasure(cubeName, function(measure, index){
      this.addMeasureToDiagram(measure);
    }, this);
  },
  getCubeTableAnnotationPrefix: function(alias, name){
    var annotationPrefix = "phase.Table." + (alias || name) + ".";
    return annotationPrefix;
  },
  createCubeRelation: function(conf){
    var metadata = conf.metadata;
    var annotationPrefix = this.getCubeTableAnnotationPrefix(metadata.alias, metadata.TABLE_NAME);
    var model = this.model;
    var cube = this.modelElement;
    var cubeName = this.modelElementPath.Cube;
    model.setAnnotationValue(cube, annotationPrefix + "x", conf.x, true);
    model.setAnnotationValue(cube, annotationPrefix + "y", conf.y, true);
    var attributes = {
      name: metadata.TABLE_NAME
    };
    if (metadata.TABLE_SCHEMA) {
      attributes.schema = metadata.TABLE_SCHEMA;
    }
    if (metadata.alias){
      attributes.alias = metadata.alias;
    }
    model.createCubeTable(cubeName, attributes);
  },
  cubeRelationAdded: function(data){
    this.addMeasuresToDiagram();
    this.addCubeDimensionsToDiagram();
    var me = this;
    window.setTimeout(function(){
      me.diagram.updateAllRelationships();
    }, 100);
  },
  addCubeRelationToDiagram: function(){
    this.getCubeRelationInfo(function(rec){
      if (rec) {
        this.diagram.addTable(rec, this.cubeRelationAdded, this);
      }
      else {
        this.cubeRelationAdded();
      }
    }, this);
  },
  saveDiagram: function() {
    var diagram = this.diagram;
    var diagramModel = diagram.getDiagramModel();
    var model = this.model;
    var cube = this.modelElement;

    diagramModel.eachSharedDimension(function(rec, index){
      var sharedDimension = rec.dimension;
      var annotationPrefix = this.getSharedDimensionAnnotationPrefix(sharedDimension);
      model.setAnnotationValue(cube, annotationPrefix + "x", rec.x, true);
      model.setAnnotationValue(cube, annotationPrefix + "y", rec.y, true);
    }, this);

    diagramModel.eachCubeDimension(function(rec, index){
      var cubeDimension = rec.dimension;
      var annotationPrefix = this.getCubeDimensionAnnotationPrefix(cubeDimension);
      model.setAnnotationValue(cubeDimension, annotationPrefix + "x", rec.x, true);
      model.setAnnotationValue(cubeDimension, annotationPrefix + "y", rec.y, true);
    }, this);

    diagramModel.eachMeasure(function(rec, index){
      var measure = rec.measure;
      var annotationPrefix = this.getMeasureAnnotationPrefix(measure);
      model.setAnnotationValue(measure, annotationPrefix + "x", rec.x, true);
      model.setAnnotationValue(measure, annotationPrefix + "y", rec.y, true);
    }, this);

    diagramModel.eachTable(function(rec, index){
      var cubeRelation = this.model.getCubeRelation(this.modelElementPath);
      if (!cubeRelation) return;
      var annotationPrefix = this.getCubeRelationAnnotationPrefix(cubeRelation);
      var cube = this.modelElement;
      model.setAnnotationValue(cube, annotationPrefix + "x", rec.x, true);
      model.setAnnotationValue(cube, annotationPrefix + "y", rec.y, true);
    }, this);
  },
  afterSetDisplayed: function(displayed){
    if (displayed) {
      this.updateDiagramIfDisplayed();
    }
  },
  updateDiagram: function(){
    this.saveDiagram();
    this.diagram.clear();
    this.addCubeRelationToDiagram();
    this.diagramNeedsUpdate = false;
  },
  tabSelected: function(tabPane, event, data){
    this.saveFieldValues();
    this.updateDiagramIfDisplayed();
    this.updateFieldValues();
  },
  modelElementChanged: function(){
    this.updateDefaultMeasuresField();

    this.diagram.clear();
    this.diagramNeedsUpdate = true;

    this.updateDiagramIfDisplayed();
  },
  createNewMeasure: function(conf){
    var cubeName = this.modelElement.attributes.name;
    var attributes, annotations;
    if (conf) {
      attributes = {
        name: conf.metadata.COLUMN_NAME,
        column: conf.metadata.COLUMN_NAME
      };
      var annotationPrefix = this.getMeasureAnnotationPrefix();
      annotations = {};
      annotations[annotationPrefix + "x"] = conf.x;
      annotations[annotationPrefix + "y"] = conf.y;
    }
    var measure = this.model.createMeasure(cubeName, attributes, annotations, false);
    var modelElementPath = merge({
      type: "Measure",
      Measure: measure.attributes.name
    }, this.modelElementPath);
    this.fireEvent("editorCreateAction", {
      model: this.model,
      modelElementPath: modelElementPath
    });
  },
  createNewCalculatedMember: function(){
    var cubeName = this.modelElement.attributes.name;
    var calculatedMember = this.model.createCalculatedMember(cubeName);
    var modelElementPath = merge({
      type: "CalculatedMember",
      CalculatedMember: calculatedMember.attributes.name
    }, this.modelElementPath);
    this.fireEvent("editorCreateAction", {
      model: this.model,
      modelElementPath: modelElementPath
    });
  },
  createNewPrivateDimension: function(){
    var model = this.model;
    var cubeName = this.modelElement.attributes.name;
    var privateDimension = model.createPrivateDimension(cubeName);

    //decorate the new dimension with a new hierarchy
    var dimensionName = privateDimension.attributes.name;
    var hierarchy = model.createPrivateDimensionHierarchy(
      cubeName, dimensionName, null, true
    );
    var hierarchyName = hierarchy.attributes.name;
    var level = model.createPrivateDimensionLevel(
      cubeName, dimensionName, hierarchyName, null, true
    );
    //end decoration

    var modelElementPath = merge({
      type: "PrivateDimension",
      PrivateDimension: privateDimension.attributes.name
    }, this.modelElementPath);
    this.fireEvent("editorCreateAction", {
      model: model,
      modelElementPath: modelElementPath
    });
  },
  createNewDimensionUsage: function(){
    var cubeName = this.modelElement.attributes.name;
    var dimensionUsage = this.model.createDimensionUsage(cubeName);
    var modelElementPath = merge({
      type: "DimensionUsage",
      DimensionUsage: dimensionUsage.attributes.name
    }, this.modelElementPath);
    this.fireEvent("editorCreateAction", {
      model: this.model,
      modelElementPath: modelElementPath
    });
  }
};
adopt(CubeEditor, GenericEditor);

(MeasureEditor = function(conf){
  linkCss("../css/phase-measure-editor.css");
  if (!conf) {
    conf = {};
  }
  if (!conf.classes) {
    conf.classes = [];
  }
  conf.classes.push("phase-measure-editor");

  if (!conf.tabs) {
    conf.tabs = [{
      text: "General",
      selected: true,
      component: cEl("div")
    }, {
      text: "Annotations",
      component: cEl("div")
    }, {
      text: "Properties",
      component: cEl("div")
    }];
  }

  arguments.callee._super.apply(this, [conf]);
}).prototype = {
  objectType: "Measure",
  fields: {
    name: fields.name,
    caption: fields.caption,
    aggregator: {
      tagName: "select",
      labelText: "Aggregator",
      dataPath: ["modelElement", "attributes", "aggregator"],
      options: ["avg", "count", "distinct-count", "min", "max", "sum"],
      mandatory: true,
      defaultValue: "distinct-count",
      tooltipText: "The function used to aggregate this measure's values."
    },
    column: {
      tagName: "select",
      labelText: "Column",
      dataPath: ["modelElement", "attributes", "column"],
      tooltipText: "Column which is source of this item's values.",
      addValue: true
    },
    datatype: fields.datatype,
    formatString: fields.formatString,
    visible: fields.visible,
    description: fields.description
  },
  updateColumnField: function(){
    var fieldName = "column";
    this.clearSelectField(fieldName);
    this.getCubeRelationInfo(function(data){
      var options = [""];
      if (data) {
        var metadata = data.metadata;
        var info = metadata.info;
        var columns = info.columns;
        var i, column, n = columns.length;
        for (i = 0; i < n; i++) {
          column = columns[i];
          options.push(column.COLUMN_NAME);
        }
      }
      this.populateSelectField(fieldName, options);
      this.setSelectFieldValue(fieldName, this.modelElement.attributes.column);
    }, this);
  },
  modelElementChanged: function(){
    this.updateColumnField()
  }
};
adopt(MeasureEditor, GenericEditor);

(CalculatedMemberEditor = function(conf){
  linkCss("../css/phase-calculated-member-editor.css");
  if (!conf) {
    conf = {};
  }
  if (!conf.classes) {
    conf.classes = [];
  }
  conf.classes.push("phase-calculated-member-editor");

  if (!conf.tabs) {
    conf.tabs = [{
      text: "General",
      selected: true,
      component: cEl("div")
    }, {
      text: "Annotations",
      component: cEl("div")
    }, {
      text: "Properties",
      component: cEl("div")
    }];
  }

  arguments.callee._super.apply(this, [conf]);
}).prototype = {
  objectType: "Calculated Member",
  fields: {
    name: fields.name,
    caption: fields.caption,
    formula: {
      tagName: "textarea",
      labelText: "Formula",
      dataPath: ["modelElement", "attributes", "formula"],
      alternativeDataPath: ["childNodes", "Formula"],
      tooltipText: "MDX expression which gives the value of this member."
    },
    hierarchy: {
      tagName: "select",
      labelText: "Hierarchy",
      dataPath: ["modelElement", "attributes", "hierarchy"],
      tooltipText: "Name of the hierarchy that this member belongs to.",
      addValue: true
    },
    parent: {
      labelText: "Parent Member",
      dataPath: ["modelElement", "attributes", "parent"],
      tooltipText: "Fully-qualified name of the parent member."
    },
    formatString: fields.formatString,
    visible: fields.visible,
    description: fields.description
  }
};
adopt(CalculatedMemberEditor, GenericEditor);

(SharedDimensionEditor = function(conf){
  linkCss("../css/phase-dimension-editor.css");
  if (!conf) {
    conf = {};
  }
  if (!conf.classes) {
    conf.classes = [];
  }
  conf.classes.push("phase-dimension-editor");

  if (!conf.toolbar) {
    conf.toolbar = {};
  }
  if (!conf.toolbar.buttons) {
    conf.toolbar.buttons = SharedDimensionEditor.prototype.toolbarButtons;
  }
  arguments.callee._super.apply(this, [conf]);
}).prototype = {
  toolbarButtons: [
    {"class": "new-hierarchy", tooltip: "New Hierarchy", handler: function(){
      this.createNewHierarchy();
    }}
  ],
  objectType: "Shared Dimension",
  fields: {
    name: fields.name,
    caption: fields.caption,
    visible: fields.visible,
    description: fields.description
  },
  getFields: function(){
    return merge(SharedDimensionEditor.prototype.fields, {
      dimensiontype: fields.dimensionType,
      highCardinality: fields.highCardinality
    });
  },
  createNewHierarchy: function(){
    var model = this.model;
    var dimensionName = this.modelElement.attributes.name;
    var hierarchy = model.createSharedDimensionHierarchy(dimensionName);

    //decorate hierarchy
    var hierarchyName = hierarchy.attributes.name;
    var level = model.createSharedDimensionLevel(
      dimensionName, hierarchyName, null, true
    );
    //end decoration

    var modelElementPath = merge({
      type: "Hierarchy",
      Hierarchy: hierarchy.attributes.name
    }, this.modelElementPath);
    this.fireEvent("editorCreateAction", {
      model: model,
      modelElementPath: modelElementPath
    });
  }
};
adopt(SharedDimensionEditor, GenericEditor);

(PrivateDimensionEditor = function(conf){
  linkCss("../css/phase-dimension-editor.css");
  if (!conf) {
    conf = {};
  }
  if (!conf.classes) {
    conf.classes = [];
  }
  conf.classes.push("phase-dimension-editor");

  if (!conf.toolbar) {
    conf.toolbar = {};
  }
  if (!conf.toolbar.buttons) {
    conf.toolbar.buttons = SharedDimensionEditor.prototype.toolbarButtons;
  }
  arguments.callee._super.apply(this, [conf]);
}).prototype = {
  objectType: "Private Dimension",
  fields: {
    usagePrefix: fields.usagePrefix,
    foreignKey: fields.foreignKey
  },
  getFields: function(){
    return merge({},
      SharedDimensionEditor.prototype.getFields.call(),
      this.fields
    );
  },
  createNewHierarchy: function(){
    var model = this.model;
    var cubeName = this.modelElementPath.Cube;
    var dimensionName = this.modelElement.attributes.name;
    var hierarchy = model.createPrivateDimensionHierarchy(cubeName, dimensionName);

    //decorate hierarchy
    var hierarchyName = hierarchy.attributes.name;
    var level = model.createPrivateDimensionLevel(
      cubeName, dimensionName, hierarchyName, null, true
    );
    //end decoration

    var modelElementPath = merge({
      type: "Hierarchy",
      Hierarchy: hierarchy.attributes.name
    }, this.modelElementPath);
    this.fireEvent("editorCreateAction", {
      model: model,
      modelElementPath: modelElementPath
    });
  },
  updateForeignKeyField: function(){
    var fieldName = "foreignKey";
    this.clearSelectField(fieldName);
    this.getCubeRelationInfo(function(data){
      var options = [""];
      if (data) {
        var metadata = data.metadata;
        var info = metadata.info;
        var columns = info.columns;
        var i, column, n = columns.length;
        for (i = 0; i < n; i++) {
          column = columns[i];
          options.push(column.COLUMN_NAME);
        }
      }
      this.populateSelectField(fieldName, options);
      this.setSelectFieldValue(fieldName, this.modelElement.attributes.foreignKey);
    }, this);
  },
  modelElementChanged: function(){
    this.updateForeignKeyField()
  }
};
adopt(PrivateDimensionEditor, GenericEditor);

(DimensionUsageEditor = function(conf){
  linkCss("../css/phase-dimension-usage-editor.css");
  if (!conf) {
    conf = {};
  }
  if (!conf.classes) {
    conf.classes = [];
  }
  conf.classes.push("phase-dimension-usage-editor");
  arguments.callee._super.apply(this, [conf]);
}).prototype = {
  objectType: "Shared Dimension Usage",
  fields: merge(
    {
      source: {
        labelText: "Shared Dimension",
        tagName: "select",
        dataPath: ["modelElement", "attributes","source"],
        mandatory: true,
        tooltipText: "The name of the shared dimension that used by this cube.",
        addValue: true
      },
      level: {
        labelText: "Join to Level",
        tagName: "select",
        dataPath: ["modelElement", "attributes","level"],
        tooltipText: "Name of the level to join to. If not specified, joins to the lowest level of the dimension.",
        addValue: true
      }
    },
    SharedDimensionEditor.prototype.fields,
    PrivateDimensionEditor.prototype.fields
  ),
  handleModelEvent:function(event, data){
    switch (data.modelElementPath.type) {
      case "SharedDimension":
        switch (event) {
          case "modelElementCreated":
          case "modelElementRemoved":
            this.updateSharedDimensionsField();
            break;
          default:
        }
        break;
      default:
    }
  },
  updateSharedDimensionsField: function(){
    var fieldName = "source";
    var options = [""];
    this.model.eachSharedDimension(function(sharedDimension){
      options.push(sharedDimension.attributes.name);
    });
    this.clearSelectField(fieldName);
    this.populateSelectField(fieldName, options);
  },
  modelChanged: function(){
    this.updateSharedDimensionsField();
  },
  updateForeignKeyField: PrivateDimensionEditor.prototype.updateForeignKeyField,
  modelElementChanged: PrivateDimensionEditor.prototype.modelElementChanged,
};
adopt(DimensionUsageEditor, GenericEditor);

(HierarchyEditor = function(conf){
  linkCss("../css/phase-hierarchy-editor.css");
  if (!conf) {
    conf = {};
  }
  if (!conf.classes) {
    conf.classes = [];
  }
  conf.classes.push("phase-hierarchy-editor");

  this.diagram = new HierarchyDiagram({
    pedisCache: conf.pedisCache,
    dnd: conf.dnd,
    classes: ["phase-hierarchy-diagram"],
    listeners: {
      scope: this,
      editDiagramElement: function(diagram, event, data){
        this.fireEvent(event, data);
      },
      removeDiagramElement: function(diagram, event, data){
      },
      changeName: function(diagram, event, data){
      },
      nameChanged: function(diagram, event, data){
      },
      createTable: function(diagram, event, conf) {
        this.createHierarchyRelation(conf);
      },
      createLevel: function(diagram, event, conf){
        this.createNewLevel(conf);
      }
    }
  });

  if (!conf.tabs) {
    conf.tabs = [{
      text: "General",
      selected: true,
      component: cEl("div")
    }, {
      text: "Diagram",
      component: this.diagram
    }, {
      text: "Annotations",
      component: cEl("div")
    }];
  }

  if (!conf.toolbar) {
    conf.toolbar = {};
  }
  if (!conf.toolbar.buttons) {
    conf.toolbar.buttons = [
      {"class": "new-level", tooltip: "New Level", handler: function(){
        this.createNewLevel();
      }},
    ];
  }

  arguments.callee._super.apply(this, [conf]);
}).prototype = {
  objectType: "Hierarchy",
  fields: {
    name: fields.name,
    caption: fields.caption,
    visible: fields.visible,
    primaryKeyTable: {
      tagName: "select",
      labelText: "Dimension Table",
      dataPath: ["modelElement", "attributes", "primaryKeyTable"],
      tooltipText: "The name of the dimension table that is bound to the fact table.",
      addValue: true
    },
    primaryKey: {
      tagName: "select",
      labelText: "Dimension Table Key",
      dataPath: ["modelElement", "attributes", "primaryKey"],
      tooltipText: "The name of the column in the dimension table that is used to bind the the fact table.",
      addValue: true
    },
    uniqueKeyLevelName: {
      tagName: "select",
      labelText: "Unique Key Level",
      dataPath: ["modelElement", "attributes", "uniqueKeyLevelName"],
      tooltipText: "Should be set to the level (if such a level exists) at which depth it is known that all members have entirely unique rows. (To optimize the query by GROUP BY elimination)",
      defaultValue: ""
    },
    description: fields.description,
    _column1: null,
    hasAll: {
      inputType: "checkbox",
      labelText: "Has \"All\" level",
      dataPath: ["modelElement", "attributes", "hasAll"],
      defaultValue: true,
      mandatory: true,
      tooltipText: "Check to specify that this hierarchy has an \"All\" level."
    },
    allLevelName: {
      labelText: "\"All\" level name",
      dataPath: ["modelElement", "attributes", "allLevelName"],
      defaultValue: "(All)",
      tooltipText: "Name of the 'all' level. If this attribute is not specified, the all member is named '(All)'."
    },
    allMemberName: {
      labelText: "\"All\" member name",
      dataPath: ["modelElement", "attributes", "allMemberName"],
      tooltipText: "Name of the \"All\" member. If this attribute is not specified, the all member is named 'All hierarchyName', for example, 'All Store'."
    },
    allMemberCaption: {
      labelText: "\"All\" member caption",
      dataPath: ["modelElement", "attributes", "allMemberCaption"],
      tooltipText: "The human-friendly label for the \"All\" member to be used in graphical front-ends."
    }
  },
  createNewLevel: function(){
    var model = this.model;
    var modelElementPath = this.modelElementPath;
    var level;
    if (modelElementPath.SharedDimension) {
      level = model.createSharedDimensionLevel(
        modelElementPath.SharedDimension,
        modelElementPath.Hierarchy
      );
    }
    else {
      level = model.createPrivateDimensionLevel(
        modelElementPath.Cube,
        modelElementPath.PrivateDimension,
        modelElementPath.Hierarchy
      );
    }
    modelElementPath = merge({
      type: "Level",
      Hierarchy: level.attributes.name
    }, this.modelElementPath);
    this.fireEvent("editorCreateAction", {
      model: this.model,
      modelElementPath: modelElementPath
    });
  },
  afterSetDisplayed: function(displayed){
    if (displayed) {
      this.updateDiagramIfDisplayed();
    }
  },
  getHierarchyRelationAnnotationPrefix: function(index){
    return "phase.Relation" + index + ".";
  },
  getHierarchyRelationsInfo: function(relations, index, callback1, callback2, scope){
    if (!index) {
      index = 0;
    }

    if (index >= relations.length) {
      callback2.call(scope);
      return;
    }

    var relation = relations[index];
    switch (relation.tagName) {
      case "Table":
        break;
      default:
        this.getHierarchyRelationsInfo(relations, ++index, callback1, callback2, scope);
        return;
    }

    this.getRelationInfo(relation, function(table){
      var annotationPrefix = this.getHierarchyRelationAnnotationPrefix(index);
      var rec = {
        metadata: table,
      };
      var model = this.model, modelElement = this.modelElement;
      var x = model.getAnnotationValue(modelElement, annotationPrefix + "x");
      if (!x) {
        var diagram = this.diagram;
        var diagramModel = diagram.getDiagramModel();
        var tableId = diagram.getTableIdForIndex(diagramModel.getTableCount() - 1);
        var lastTable = gEl(tableId);
        if (lastTable) {
          x = lastTable.clientLeft + lastTable.clientWidth + 50;
        }
        else {
          x = 10;
        }
      }
      rec.x = x;
      var y = model.getAnnotationValue(modelElement, annotationPrefix + "y");
      if (y) {
        rec.y = y;
      }
      var alias = relation.attributes.alias;
      if (alias) {
        rec.alias = alias;
      }
      callback1.call(scope || null, rec);
      this.getHierarchyRelationsInfo(relations, ++index, callback1, callback2, scope);
    }, this);
  },
  createHierarchyRelation: function(conf){
    this.diagram.addTable(conf);
  },
  addTableRelationshipToDiagram: function(relationship) {
    var join = relationship.join;
    var joinAttributes = join.attributes;

    var diagram = this.diagram;
    var diagramModel = diagram.getDiagramModel();

    var left = relationship.left.relation;
    var leftIndex = diagramModel.getTableIndex({
      TABLE_NAME: left.attributes.name,
      TABLE_SCHEM: left.attributes.schema || null
    });
    var leftColumn = joinAttributes.leftKey;

    var right = relationship.right.relation;
    var rightIndex = diagramModel.getTableIndex({
      TABLE_NAME: right.attributes.name,
      TABLE_SCHEM: right.attributes.schema || null
    });
    var rightColumn = joinAttributes.rightKey;

    diagramModel.addTableRelationship({
      leftTable: leftIndex,
      leftColumn: leftColumn,
      rightTable: rightIndex,
      rightColumn: rightColumn
    });
  },
  addTableRelationshipsToDiagram: function(){
    var relationsInfo = this.getHierarchyRelations();
    var relationships = relationsInfo.relationships,
        relationship, i, n = relationships.length
    ;
    for (i = 0; i < n; i++){
      relationship = relationships[i];
      this.addTableRelationshipToDiagram(relationship);
    }
  },
  addLevelToDiagram: function(level, i) {
    var model = this.model;
    var x = parseInt(model.getAnnotationValue(level, "phase.x"), 10);
    if (!x) {
      x = this.getDom().clientWidth - 250;
    }
    var y = parseInt(model.getAnnotationValue(level, "phase.x"), 10);
    if (!y) {
      var diagram = this.diagram;
      var diagramModel = diagram.getDiagramModel();
      y = 10 + (diagramModel.getLevelCount() * 160);
    }
    this.diagram.addLevel({
      level: level,
      x: x,
      y: y
    });
  },
  addLevelsToDiagram: function(){
    var model = this.model;
    var modelElement = this.modelElement;
    model.eachLevel(modelElement, function(level, i){
      this.addLevelToDiagram(level, i);
    }, this);
  },
  addHierarchyRelationsToDiagram: function(){
    var relationsInfo = this.getHierarchyRelations();
    var tableIndex = 0;

    var modelElement = this.modelElement;
    var attributes = modelElement.attributes;

    var primaryKeyTable = attributes.primaryKeyTable;
    var primaryKeyColumn = attributes.primaryKey;
    var primaryKeyTableIndex;

    this.getHierarchyRelationsInfo(relationsInfo.relations, 0, function(rec){

      this.diagram.addTable(rec, function(){
        if (
          (primaryKeyTable === (rec.metadata.TABLE_NAME || rec.alias))  ||
          (!primaryKeyTable && tableIndex === 0)
        ) {
          primaryKeyTableIndex = tableIndex;
          var diagramModel = this.diagram.getDiagramModel();
          diagramModel.setPrimaryKey(primaryKeyTableIndex, primaryKeyColumn);
        }
      }, this);
      tableIndex++;

    }, function(){
      this.addTableRelationshipsToDiagram();
      this.addLevelsToDiagram();
    }, this);
  },
  saveDiagram: function(){
    var diagram = this.diagram;
    var diagramModel = this.diagram.getDiagramModel();
  },
  updateDiagram: function(){
    this.saveDiagram();
    this.diagram.clear();
    this.addHierarchyRelationsToDiagram();
    this.diagramNeedsUpdate = false;
  },
  tabSelected: function(tabPane, event, data){
    this.updateDiagramIfDisplayed();
    this.updateFieldValues();
  },
  updateUniqueKeyLevelNameField: function(){
    var fieldName = "uniqueKeyLevelName";
    var options = [""];
    this.model.eachHierarchyLevel(this.modelElement, function(level, index){
      options.push(level.attributes.name);
    });
    this.clearSelectField(fieldName);
    this.populateSelectField(fieldName, options);
  },
  fieldCreated: function(fieldset, key, definition, tabIndex){
    switch (key) {
      case "primaryKeyTable":
        listen(this.getFieldElement(key), "change", function(){
          this.updatePrimaryKeyField();
        }, this);
        break;
    }
  },
  updatePrimaryKeyTableField: function(){
    this.populateSelectFieldWithHierarchyRelations("primaryKeyTable");
  },
  fieldUpdated: function(fieldName, value) {
    switch (fieldName) {
      case "primaryKeyTable":
        var primaryKeyTable = this.modelElement.attributes.primaryKeyTable;
        if (!primaryKeyTable) {
          var options = this.getFieldElement(fieldName).options;
          primaryKeyTable = options[options.length - 1].value;
          this.setSelectFieldValue(fieldName, primaryKeyTable);
        }
        this.updatePrimaryKeyField();
        break;
      default:
    }
  },
  updatePrimaryKeyField: function(){
    this.populateSelectFieldWithHierarchyRelationColumns("primaryKeyTable", "primaryKey");
  },
  modelElementChanged: function(){
    this.updateUniqueKeyLevelNameField();
    this.updatePrimaryKeyTableField();

    this.diagram.clear();
    this.diagramNeedsUpdate = true;

    this.updateDiagramIfDisplayed();
  },
  modelChanged: function(){
    this.updateUniqueKeyLevelNameField();
    this.updatePrimaryKeyTableField();

    this.diagram.clear();
    this.diagramNeedsUpdate = true;

    this.updateDiagramIfDisplayed();
  },
};
adopt(HierarchyEditor, GenericEditor);

(LevelEditor = function(conf){
  linkCss("../css/phase-level-editor.css");
  if (!conf) {
    conf = {};
  }
  if (!conf.classes) {
    conf.classes = [];
  }

  if (!conf.tabs) {
    conf.tabs = [{
      text: "General",
      selected: true,
      component: cEl("div")
    }, {
      text: "Annotations",
      component: cEl("div")
    }, {
      text: "Properties",
      component: cEl("div")
    }];
  }

  conf.classes.push("phase-level-editor");

  arguments.callee._super.apply(this, [conf]);
}).prototype = {
  columns: 2,
  objectType: "Level",
  fields: {
    name: fields.name,
    caption: fields.caption,
    levelType: {
      labelText: "Level Type",
      tagName: "select",
      tooltipText: "Whether this is a regular or a time-related level.",
      dataPath: ["modelElement", "attributes", "levelType"],
      options: ["", "TimeYears", "TimeQuarters", "TimeMonths", "TimeWeeks", "TimeDays"]
    },
    type: merge({
      dataPath: ["modelElement", "attributes", "type"]
    }, fields.datatype),
    internalType: {
      labelText: "Java Type",
      tagName: "select",
      tooltipText: "Indicates the Java type (and JDBC method) that Mondrian uses to store and retrieve this level's key column.",
      dataPath: ["modelElement", "attributes", "internalType"],
      options: ["", "int", "long", "Object", "String"]
    },
    visible: fields.visible,
    hideMemberIf: {
      labelText: "Hide Member If",
      tagName: "select",
      tooltipText: "Condition which determines whether a member of this level is hidden.",
      dataPath: ["modelElement", "attributes", "hideMemberIf"],
      options: ["Never", "IfBlankName", "IfParentsName"]
    },
    description: fields.description,
    _column1: null,
    table: {
      labelText: "Table Name",
      tagName: "select",
      dataPath: ["modelElement", "attributes", "table"],
      tooltipText: "The name of the table that stores this level's values.",
      addValue: true
    },
    column: {
      labelText: "Level Key Column",
      tagName: "select",
      dataPath: ["modelElement", "attributes", "column"],
      tooltipText: "The name of the column which uniquely identifies the members in this level.",
      addValue: true
    },
    approxRowCount: {
      labelText: "Approx. Row Count",
      dataPath: ["modelElement", "attributes", "approxRowCount"],
      tooltipText: "The estimated number of members in this level."
    },
    uniqueMembers: {
      inputType: "checkbox",
      labelText:  "Is unique?",
      dataPath: ["modelElement", "attributes", "uniqueMembers"],
      tooltipText: "Indicates whether the values in this level are unique."
    },
    nameColumn: {
      labelText: "Level Name Column",
      tagName: "select",
      dataPath: ["modelElement", "attributes", "nameColumn"],
      tooltipText: "The name of the column which gives the members in this level a unique name.",
      addValue: true
    },
    ordinalColumn: {
      labelText: "Level Ordinal Column",
      tagName: "select",
      dataPath: ["modelElement", "attributes", "ordinalColumn"],
      tooltipText: "The name of the column that is used to sort the members in this level.",
      addValue: true
    },
    captionColumn: {
      labelText: "Level Caption Column",
      tagName: "select",
      dataPath: ["modelElement", "attributes", "captionColumn"],
      tooltipText: "The name of the column which holds the caption of this level's members.",
      addValue: true
    },
    parentColumn: {
      labelText: "Parent Column",
      tagName: "select",
      dataPath: ["modelElement", "attributes", "parentColumns"],
      tooltipText: "The name of the column which references the parent member in a parent-child hierarchy.",
      addValue: true
    },
    nullParentValue: {
      labelText: "Null Parent Value",
      dataPath: ["modelElement", "attributes", "nullParentValue"],
      tooltipText: "Value which identifies null parents in a parent-child hierarchy."
    }
  },
  updateTableField: function(){
    this.populateSelectFieldWithHierarchyRelations("table");
  },
  fieldUpdated: function(fieldName, value) {
    switch (fieldName) {
      case "table":
        var table = this.modelElement.attributes.table;
        if (!table) {
          var options = this.getFieldElement(fieldName).options;
          table = options[options.length - 1].value;
          this.setSelectFieldValue(fieldName, table);
        }
        this.updateColumnFields();
        break;
      default:
    }
  },
  updateColumnFields: function(){
    this.updateColumnField();
    this.updateNameColumnField();
    this.updateOrdinalColumnField();
    this.updateCaptionColumnField();
    this.updateParentColumnField();
  },
  updateColumnField: function(){
    this.populateSelectFieldWithHierarchyRelationColumns("table", "column");
  },
  updateNameColumnField: function(){
    this.populateSelectFieldWithHierarchyRelationColumns("table", "nameColumn");
  },
  updateOrdinalColumnField: function(){
    this.populateSelectFieldWithHierarchyRelationColumns("table", "ordinalColumn");
  },
  updateCaptionColumnField: function(){
    this.populateSelectFieldWithHierarchyRelationColumns("table", "captionColumn");
  },
  updateParentColumnField: function(){
    this.populateSelectFieldWithHierarchyRelationColumns("table", "parentColumn");
  },
  modelElementChanged: function(){
    this.updateTableField();
  },
  modelChanged: function(){
    this.updateTableField();
  },
};
adopt(LevelEditor, GenericEditor);

linkCss("../css/phase-editor.css");
linkCss("../../lib/pure/css/pure-min.css");
linkCss("../../lib/pure/css/grids-responsive-min.css");

})();