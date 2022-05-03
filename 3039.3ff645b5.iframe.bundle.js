/*! For license information please see 3039.3ff645b5.iframe.bundle.js.LICENSE.txt */
"use strict";(self.webpackChunk_midspace_frontend=self.webpackChunk_midspace_frontend||[]).push([[3039],{"../node_modules/.pnpm/react-async-hook@4.0.0_react@17.0.2/node_modules/react-async-hook/dist/react-async-hook.esm.js":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{__webpack_require__.d(__webpack_exports__,{r5:()=>useAsync});var react__WEBPACK_IMPORTED_MODULE_0__=__webpack_require__("../node_modules/.pnpm/react@17.0.2/node_modules/react/index.js");function _extends(){return _extends=Object.assign||function(target){for(var i=1;i<arguments.length;i++){var source=arguments[i];for(var key in source)Object.prototype.hasOwnProperty.call(source,key)&&(target[key]=source[key])}return target},_extends.apply(this,arguments)}"undefined"!=typeof Symbol&&(Symbol.iterator||(Symbol.iterator=Symbol("Symbol.iterator"))),"undefined"!=typeof Symbol&&(Symbol.asyncIterator||(Symbol.asyncIterator=Symbol("Symbol.asyncIterator")));var useIsomorphicLayoutEffect="undefined"!=typeof window&&void 0!==window.document&&void 0!==window.document.createElement?react__WEBPACK_IMPORTED_MODULE_0__.useLayoutEffect:react__WEBPACK_IMPORTED_MODULE_0__.useEffect,InitialAsyncState={status:"not-requested",loading:!1,result:void 0,error:void 0},InitialAsyncLoadingState={status:"loading",loading:!0,result:void 0,error:void 0},noop=function noop(){},DefaultOptions={initialState:function initialState(options){return options&&options.executeOnMount?InitialAsyncLoadingState:InitialAsyncState},executeOnMount:!0,executeOnUpdate:!0,setLoading:function defaultSetLoading(_asyncState){return InitialAsyncLoadingState},setResult:function defaultSetResult(result,_asyncState){return{status:"success",loading:!1,result,error:void 0}},setError:function defaultSetError(error,_asyncState){return{status:"error",loading:!1,result:void 0,error}},onSuccess:noop,onError:noop},useAsyncInternal=function useAsyncInternal(asyncFunction,params,options){!params&&(params=[]);var normalizedOptions=function normalizeOptions(options){return _extends({},DefaultOptions,{},options)}(options),_useState2=(0,react__WEBPACK_IMPORTED_MODULE_0__.useState)(null),currentParams=_useState2[0],setCurrentParams=_useState2[1],AsyncState=function useAsyncState(options){var _useState=(0,react__WEBPACK_IMPORTED_MODULE_0__.useState)((function(){return options.initialState(options)})),value=_useState[0],setValue=_useState[1],reset=(0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)((function(){return setValue(options.initialState(options))}),[setValue,options]),setLoading=(0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)((function(){return setValue(options.setLoading(value))}),[value,setValue]),setResult=(0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)((function(result){return setValue(options.setResult(result,value))}),[value,setValue]),setError=(0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)((function(error){return setValue(options.setError(error,value))}),[value,setValue]),merge=(0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)((function(state){return setValue(_extends({},value,{},state))}),[value,setValue]);return{value,set:setValue,merge,reset,setLoading,setResult,setError}}(normalizedOptions),isMounted=function useIsMounted(){var ref=(0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(!1);return(0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)((function(){return ref.current=!0,function(){ref.current=!1}}),[]),function(){return ref.current}}(),CurrentPromise=function useCurrentPromise(){var ref=(0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(null);return{set:function set(promise){return ref.current=promise},get:function get(){return ref.current},is:function is(promise){return ref.current===promise}}}(),shouldHandlePromise=function shouldHandlePromise(p){return isMounted()&&CurrentPromise.is(p)},getLatestExecuteAsyncOperation=function useGetter(t){var ref=(0,react__WEBPACK_IMPORTED_MODULE_0__.useRef)(t);return useIsomorphicLayoutEffect((function(){ref.current=t})),(0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)((function(){return ref.current}),[ref])}((function executeAsyncOperation(){for(var _len=arguments.length,args=new Array(_len),_key=0;_key<_len;_key++)args[_key]=arguments[_key];var promise=function(){try{return Promise.resolve(asyncFunction.apply(void 0,args))}catch(e){return Promise.reject(e)}}();return setCurrentParams(args),CurrentPromise.set(promise),AsyncState.setLoading(),promise.then((function(result){shouldHandlePromise(promise)&&AsyncState.setResult(result),normalizedOptions.onSuccess(result,{isCurrent:function isCurrent(){return CurrentPromise.is(promise)}})}),(function(error){shouldHandlePromise(promise)&&AsyncState.setError(error),normalizedOptions.onError(error,{isCurrent:function isCurrent(){return CurrentPromise.is(promise)}})})),promise})),executeAsyncOperationMemo=(0,react__WEBPACK_IMPORTED_MODULE_0__.useCallback)((function(){return getLatestExecuteAsyncOperation().apply(void 0,arguments)}),[getLatestExecuteAsyncOperation]),isMounting=!isMounted();return(0,react__WEBPACK_IMPORTED_MODULE_0__.useEffect)((function(){var execute=function execute(){return getLatestExecuteAsyncOperation().apply(void 0,params)};isMounting&&normalizedOptions.executeOnMount&&execute(),!isMounting&&normalizedOptions.executeOnUpdate&&execute()}),params),_extends({},AsyncState.value,{set:AsyncState.set,merge:AsyncState.merge,reset:AsyncState.reset,execute:executeAsyncOperationMemo,currentPromise:CurrentPromise.get(),currentParams})};function useAsync(asyncFunction,params,options){return useAsyncInternal(asyncFunction,params,options)}},"../node_modules/.pnpm/use-react-router-breadcrumbs@2.0.2_react-router@5.2.1+react@17.0.2/node_modules/use-react-router-breadcrumbs/dist/es/index.js":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{__webpack_require__.d(__webpack_exports__,{Z:()=>__WEBPACK_DEFAULT_EXPORT__});var _babel_runtime_helpers_toConsumableArray__WEBPACK_IMPORTED_MODULE_2__=__webpack_require__("../node_modules/.pnpm/@babel+runtime@7.15.4/node_modules/@babel/runtime/helpers/esm/toConsumableArray.js"),react__WEBPACK_IMPORTED_MODULE_0__=__webpack_require__("../node_modules/.pnpm/react@17.0.2/node_modules/react/index.js"),react_router__WEBPACK_IMPORTED_MODULE_1__=__webpack_require__("../node_modules/.pnpm/react-router@5.2.1_react@17.0.2/node_modules/react-router/esm/react-router.js");var DEFAULT_MATCH_OPTIONS={exact:!0},humanize=function humanize(str){return str.replace(/^[\s_]+|[\s_]+$/g,"").replace(/[_\s]+/g," ").replace(/^[a-z]/,(function(m){return m.toUpperCase()}))},render=function render(_ref){var Breadcrumb=_ref.breadcrumb,match=_ref.match,location=_ref.location,props=_ref.props,componentProps=Object.assign({match,location,key:match.url},props||{});return Object.assign(Object.assign({},componentProps),{breadcrumb:"string"==typeof Breadcrumb?(0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span",{key:componentProps.key},Breadcrumb):react__WEBPACK_IMPORTED_MODULE_0__.createElement(Breadcrumb,Object.assign({},componentProps))})},getBreadcrumbMatch=function getBreadcrumbMatch(_ref3){var breadcrumb,currentSection=_ref3.currentSection,disableDefaults=_ref3.disableDefaults,excludePaths=_ref3.excludePaths,location=_ref3.location,pathSection=_ref3.pathSection,routes=_ref3.routes;return excludePaths&&excludePaths.some((function getIsPathExcluded(path){return null!=(0,react_router__WEBPACK_IMPORTED_MODULE_1__.LX)(pathSection,{path,exact:!0,strict:!1})}))?"NO_BREADCRUMB":(routes.some((function(_a){var userProvidedBreadcrumb=_a.breadcrumb,matchOptions=_a.matchOptions,path=_a.path,rest=function __rest(s,e){var t={};for(var p in s)Object.prototype.hasOwnProperty.call(s,p)&&e.indexOf(p)<0&&(t[p]=s[p]);if(null!=s&&"function"==typeof Object.getOwnPropertySymbols){var i=0;for(p=Object.getOwnPropertySymbols(s);i<p.length;i++)e.indexOf(p[i])<0&&Object.prototype.propertyIsEnumerable.call(s,p[i])&&(t[p[i]]=s[p[i]])}return t}(_a,["breadcrumb","matchOptions","path"]);if(!path)throw new Error("useBreadcrumbs: `path` must be provided in every route object");var match=(0,react_router__WEBPACK_IMPORTED_MODULE_1__.LX)(pathSection,Object.assign(Object.assign({},matchOptions||DEFAULT_MATCH_OPTIONS),{path}));return match&&null===userProvidedBreadcrumb||!match&&matchOptions?(breadcrumb="NO_BREADCRUMB",!0):!!match&&(!userProvidedBreadcrumb&&disableDefaults?(breadcrumb="NO_BREADCRUMB",!0):(breadcrumb=render(Object.assign({breadcrumb:userProvidedBreadcrumb||humanize(currentSection),match,location},rest)),!0))})),breadcrumb||(disableDefaults?"NO_BREADCRUMB":function getDefaultBreadcrumb(_ref2){var currentSection=_ref2.currentSection,location=_ref2.location,pathSection=_ref2.pathSection,match=(0,react_router__WEBPACK_IMPORTED_MODULE_1__.LX)(pathSection,Object.assign(Object.assign({},DEFAULT_MATCH_OPTIONS),{path:pathSection}))||{url:"not-found"};return render({breadcrumb:humanize(currentSection),match,location})}({pathSection,currentSection:"/"===pathSection?"Home":currentSection,location})))},flattenRoutes=function flattenRoutes(routes){return routes.reduce((function(arr,route){return route.routes?arr.concat([route].concat((0,_babel_runtime_helpers_toConsumableArray__WEBPACK_IMPORTED_MODULE_2__.Z)(flattenRoutes(route.routes)))):arr.concat(route)}),[])};const __WEBPACK_DEFAULT_EXPORT__=function useReactRouterBreadcrumbs(routes,options){return function getBreadcrumbs(_ref4){var routes=_ref4.routes,location=_ref4.location,_ref4$options=_ref4.options,options=void 0===_ref4$options?{}:_ref4$options,matches=[];return location.pathname.split("?")[0].split("/").reduce((function(previousSection,currentSection,index){var pathSection=currentSection?"".concat(previousSection,"/").concat(currentSection):"/";if("/"===pathSection&&0!==index)return"";var breadcrumb=getBreadcrumbMatch(Object.assign({currentSection,location,pathSection,routes},options));return"NO_BREADCRUMB"!==breadcrumb&&matches.push(breadcrumb),"/"===pathSection?"":pathSection}),""),matches}({routes:flattenRoutes(routes||[]),location:(0,react_router__WEBPACK_IMPORTED_MODULE_1__.TH)(),options})}},"../node_modules/.pnpm/@babel+runtime@7.15.4/node_modules/@babel/runtime/helpers/esm/toConsumableArray.js":(__unused_webpack___webpack_module__,__webpack_exports__,__webpack_require__)=>{function _arrayLikeToArray(arr,len){(null==len||len>arr.length)&&(len=arr.length);for(var i=0,arr2=new Array(len);i<len;i++)arr2[i]=arr[i];return arr2}function _toConsumableArray(arr){return function _arrayWithoutHoles(arr){if(Array.isArray(arr))return _arrayLikeToArray(arr)}(arr)||function _iterableToArray(iter){if("undefined"!=typeof Symbol&&null!=iter[Symbol.iterator]||null!=iter["@@iterator"])return Array.from(iter)}(arr)||function _unsupportedIterableToArray(o,minLen){if(o){if("string"==typeof o)return _arrayLikeToArray(o,minLen);var n=Object.prototype.toString.call(o).slice(8,-1);return"Object"===n&&o.constructor&&(n=o.constructor.name),"Map"===n||"Set"===n?Array.from(o):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?_arrayLikeToArray(o,minLen):void 0}}(arr)||function _nonIterableSpread(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}__webpack_require__.d(__webpack_exports__,{Z:()=>_toConsumableArray})},"../node_modules/.pnpm/mustache@4.2.0/node_modules/mustache/mustache.mjs":(__unused_webpack___webpack_module__,__webpack_exports__,__webpack_require__)=>{__webpack_require__.d(__webpack_exports__,{Z:()=>__WEBPACK_DEFAULT_EXPORT__});var objectToString=Object.prototype.toString,isArray=Array.isArray||function isArrayPolyfill(object){return"[object Array]"===objectToString.call(object)};function isFunction(object){return"function"==typeof object}function escapeRegExp(string){return string.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g,"\\$&")}function hasProperty(obj,propName){return null!=obj&&"object"==typeof obj&&propName in obj}var regExpTest=RegExp.prototype.test;var nonSpaceRe=/\S/;function isWhitespace(string){return!function testRegExp(re,string){return regExpTest.call(re,string)}(nonSpaceRe,string)}var entityMap={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","/":"&#x2F;","`":"&#x60;","=":"&#x3D;"};var whiteRe=/\s*/,spaceRe=/\s+/,equalsRe=/\s*=/,curlyRe=/\s*\}/,tagRe=/#|\^|\/|>|\{|&|=|!/;function Scanner(string){this.string=string,this.tail=string,this.pos=0}function Context(view,parentContext){this.view=view,this.cache={".":this.view},this.parent=parentContext}function Writer(){this.templateCache={_cache:{},set:function set(key,value){this._cache[key]=value},get:function get(key){return this._cache[key]},clear:function clear(){this._cache={}}}}Scanner.prototype.eos=function eos(){return""===this.tail},Scanner.prototype.scan=function scan(re){var match=this.tail.match(re);if(!match||0!==match.index)return"";var string=match[0];return this.tail=this.tail.substring(string.length),this.pos+=string.length,string},Scanner.prototype.scanUntil=function scanUntil(re){var match,index=this.tail.search(re);switch(index){case-1:match=this.tail,this.tail="";break;case 0:match="";break;default:match=this.tail.substring(0,index),this.tail=this.tail.substring(index)}return this.pos+=match.length,match},Context.prototype.push=function push(view){return new Context(view,this)},Context.prototype.lookup=function lookup(name){var value,primitive,propName,cache=this.cache;if(cache.hasOwnProperty(name))value=cache[name];else{for(var intermediateValue,names,index,context=this,lookupHit=!1;context;){if(name.indexOf(".")>0)for(intermediateValue=context.view,names=name.split("."),index=0;null!=intermediateValue&&index<names.length;)index===names.length-1&&(lookupHit=hasProperty(intermediateValue,names[index])||(primitive=intermediateValue,propName=names[index],null!=primitive&&"object"!=typeof primitive&&primitive.hasOwnProperty&&primitive.hasOwnProperty(propName))),intermediateValue=intermediateValue[names[index++]];else intermediateValue=context.view[name],lookupHit=hasProperty(context.view,name);if(lookupHit){value=intermediateValue;break}context=context.parent}cache[name]=value}return isFunction(value)&&(value=value.call(this.view)),value},Writer.prototype.clearCache=function clearCache(){void 0!==this.templateCache&&this.templateCache.clear()},Writer.prototype.parse=function parse(template,tags){var cache=this.templateCache,cacheKey=template+":"+(tags||mustache.tags).join(":"),isCacheEnabled=void 0!==cache,tokens=isCacheEnabled?cache.get(cacheKey):void 0;return null==tokens&&(tokens=function parseTemplate(template,tags){if(!template)return[];var openingTagRe,closingTagRe,closingCurlyRe,lineHasNonSpace=!1,sections=[],tokens=[],spaces=[],hasTag=!1,nonSpace=!1,indentation="",tagIndex=0;function stripSpace(){if(hasTag&&!nonSpace)for(;spaces.length;)delete tokens[spaces.pop()];else spaces=[];hasTag=!1,nonSpace=!1}function compileTags(tagsToCompile){if("string"==typeof tagsToCompile&&(tagsToCompile=tagsToCompile.split(spaceRe,2)),!isArray(tagsToCompile)||2!==tagsToCompile.length)throw new Error("Invalid tags: "+tagsToCompile);openingTagRe=new RegExp(escapeRegExp(tagsToCompile[0])+"\\s*"),closingTagRe=new RegExp("\\s*"+escapeRegExp(tagsToCompile[1])),closingCurlyRe=new RegExp("\\s*"+escapeRegExp("}"+tagsToCompile[1]))}compileTags(tags||mustache.tags);for(var start,type,value,chr,token,openSection,scanner=new Scanner(template);!scanner.eos();){if(start=scanner.pos,value=scanner.scanUntil(openingTagRe))for(var i=0,valueLength=value.length;i<valueLength;++i)isWhitespace(chr=value.charAt(i))?(spaces.push(tokens.length),indentation+=chr):(nonSpace=!0,lineHasNonSpace=!0,indentation+=" "),tokens.push(["text",chr,start,start+1]),start+=1,"\n"===chr&&(stripSpace(),indentation="",tagIndex=0,lineHasNonSpace=!1);if(!scanner.scan(openingTagRe))break;if(hasTag=!0,type=scanner.scan(tagRe)||"name",scanner.scan(whiteRe),"="===type?(value=scanner.scanUntil(equalsRe),scanner.scan(equalsRe),scanner.scanUntil(closingTagRe)):"{"===type?(value=scanner.scanUntil(closingCurlyRe),scanner.scan(curlyRe),scanner.scanUntil(closingTagRe),type="&"):value=scanner.scanUntil(closingTagRe),!scanner.scan(closingTagRe))throw new Error("Unclosed tag at "+scanner.pos);if(token=">"==type?[type,value,start,scanner.pos,indentation,tagIndex,lineHasNonSpace]:[type,value,start,scanner.pos],tagIndex++,tokens.push(token),"#"===type||"^"===type)sections.push(token);else if("/"===type){if(!(openSection=sections.pop()))throw new Error('Unopened section "'+value+'" at '+start);if(openSection[1]!==value)throw new Error('Unclosed section "'+openSection[1]+'" at '+start)}else"name"===type||"{"===type||"&"===type?nonSpace=!0:"="===type&&compileTags(value)}if(stripSpace(),openSection=sections.pop())throw new Error('Unclosed section "'+openSection[1]+'" at '+scanner.pos);return function nestTokens(tokens){for(var token,nestedTokens=[],collector=nestedTokens,sections=[],i=0,numTokens=tokens.length;i<numTokens;++i)switch((token=tokens[i])[0]){case"#":case"^":collector.push(token),sections.push(token),collector=token[4]=[];break;case"/":sections.pop()[5]=token[2],collector=sections.length>0?sections[sections.length-1][4]:nestedTokens;break;default:collector.push(token)}return nestedTokens}(function squashTokens(tokens){for(var token,lastToken,squashedTokens=[],i=0,numTokens=tokens.length;i<numTokens;++i)(token=tokens[i])&&("text"===token[0]&&lastToken&&"text"===lastToken[0]?(lastToken[1]+=token[1],lastToken[3]=token[3]):(squashedTokens.push(token),lastToken=token));return squashedTokens}(tokens))}(template,tags),isCacheEnabled&&cache.set(cacheKey,tokens)),tokens},Writer.prototype.render=function render(template,view,partials,config){var tags=this.getConfigTags(config),tokens=this.parse(template,tags),context=view instanceof Context?view:new Context(view,void 0);return this.renderTokens(tokens,context,partials,template,config)},Writer.prototype.renderTokens=function renderTokens(tokens,context,partials,originalTemplate,config){for(var token,symbol,value,buffer="",i=0,numTokens=tokens.length;i<numTokens;++i)value=void 0,"#"===(symbol=(token=tokens[i])[0])?value=this.renderSection(token,context,partials,originalTemplate,config):"^"===symbol?value=this.renderInverted(token,context,partials,originalTemplate,config):">"===symbol?value=this.renderPartial(token,context,partials,config):"&"===symbol?value=this.unescapedValue(token,context):"name"===symbol?value=this.escapedValue(token,context,config):"text"===symbol&&(value=this.rawValue(token)),void 0!==value&&(buffer+=value);return buffer},Writer.prototype.renderSection=function renderSection(token,context,partials,originalTemplate,config){var self=this,buffer="",value=context.lookup(token[1]);if(value){if(isArray(value))for(var j=0,valueLength=value.length;j<valueLength;++j)buffer+=this.renderTokens(token[4],context.push(value[j]),partials,originalTemplate,config);else if("object"==typeof value||"string"==typeof value||"number"==typeof value)buffer+=this.renderTokens(token[4],context.push(value),partials,originalTemplate,config);else if(isFunction(value)){if("string"!=typeof originalTemplate)throw new Error("Cannot use higher-order sections without the original template");null!=(value=value.call(context.view,originalTemplate.slice(token[3],token[5]),(function subRender(template){return self.render(template,context,partials,config)})))&&(buffer+=value)}else buffer+=this.renderTokens(token[4],context,partials,originalTemplate,config);return buffer}},Writer.prototype.renderInverted=function renderInverted(token,context,partials,originalTemplate,config){var value=context.lookup(token[1]);if(!value||isArray(value)&&0===value.length)return this.renderTokens(token[4],context,partials,originalTemplate,config)},Writer.prototype.indentPartial=function indentPartial(partial,indentation,lineHasNonSpace){for(var filteredIndentation=indentation.replace(/[^ \t]/g,""),partialByNl=partial.split("\n"),i=0;i<partialByNl.length;i++)partialByNl[i].length&&(i>0||!lineHasNonSpace)&&(partialByNl[i]=filteredIndentation+partialByNl[i]);return partialByNl.join("\n")},Writer.prototype.renderPartial=function renderPartial(token,context,partials,config){if(partials){var tags=this.getConfigTags(config),value=isFunction(partials)?partials(token[1]):partials[token[1]];if(null!=value){var lineHasNonSpace=token[6],tagIndex=token[5],indentation=token[4],indentedValue=value;0==tagIndex&&indentation&&(indentedValue=this.indentPartial(value,indentation,lineHasNonSpace));var tokens=this.parse(indentedValue,tags);return this.renderTokens(tokens,context,partials,indentedValue,config)}}},Writer.prototype.unescapedValue=function unescapedValue(token,context){var value=context.lookup(token[1]);if(null!=value)return value},Writer.prototype.escapedValue=function escapedValue(token,context,config){var escape=this.getConfigEscape(config)||mustache.escape,value=context.lookup(token[1]);if(null!=value)return"number"==typeof value&&escape===mustache.escape?String(value):escape(value)},Writer.prototype.rawValue=function rawValue(token){return token[1]},Writer.prototype.getConfigTags=function getConfigTags(config){return isArray(config)?config:config&&"object"==typeof config?config.tags:void 0},Writer.prototype.getConfigEscape=function getConfigEscape(config){return config&&"object"==typeof config&&!isArray(config)?config.escape:void 0};var mustache={name:"mustache.js",version:"4.2.0",tags:["{{","}}"],clearCache:void 0,escape:void 0,parse:void 0,render:void 0,Scanner:void 0,Context:void 0,Writer:void 0,set templateCache(cache){defaultWriter.templateCache=cache},get templateCache(){return defaultWriter.templateCache}},defaultWriter=new Writer;mustache.clearCache=function clearCache(){return defaultWriter.clearCache()},mustache.parse=function parse(template,tags){return defaultWriter.parse(template,tags)},mustache.render=function render(template,view,partials,config){if("string"!=typeof template)throw new TypeError('Invalid template! Template should be a "string" but "'+function typeStr(obj){return isArray(obj)?"array":typeof obj}(template)+'" was given as the first argument for mustache#render(template, view, partials)');return defaultWriter.render(template,view,partials,config)},mustache.escape=function escapeHtml(string){return String(string).replace(/[&<>"'`=\/]/g,(function fromEntityMap(s){return entityMap[s]}))},mustache.Scanner=Scanner,mustache.Context=Context,mustache.Writer=Writer;const __WEBPACK_DEFAULT_EXPORT__=mustache}}]);