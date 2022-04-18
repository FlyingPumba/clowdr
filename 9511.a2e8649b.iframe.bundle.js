/*! For license information please see 9511.a2e8649b.iframe.bundle.js.LICENSE.txt */
"use strict";(self.webpackChunk_midspace_frontend=self.webpackChunk_midspace_frontend||[]).push([[9511],{"./src/aspects/Conference/Manage/DashboardPage.tsx":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{__webpack_require__.d(__webpack_exports__,{Y:()=>DashboardPage});__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.array.includes.js"),__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.string.includes.js");var chakra_ui_color_mode_esm=__webpack_require__("../node_modules/.pnpm/@chakra-ui+color-mode@1.4.3_react@17.0.2/node_modules/@chakra-ui/color-mode/dist/chakra-ui-color-mode.esm.js"),chakra_ui_layout_esm=__webpack_require__("../node_modules/.pnpm/@chakra-ui+layout@1.7.4_d5de66fc214059f645050e36d066c00a/node_modules/@chakra-ui/layout/dist/chakra-ui-layout.esm.js"),react=__webpack_require__("../node_modules/.pnpm/react@17.0.2/node_modules/react/index.js"),useTitle=__webpack_require__("./src/aspects/Hooks/useTitle.tsx"),useConference=__webpack_require__("./src/aspects/Conference/useConference.tsx"),chakra_ui_breadcrumb_esm=(__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.array.find.js"),__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.array.map.js"),__webpack_require__("../node_modules/.pnpm/@chakra-ui+breadcrumb@1.3.4_d5de66fc214059f645050e36d066c00a/node_modules/@chakra-ui/breadcrumb/dist/chakra-ui-breadcrumb.esm.js")),react_router_dom=__webpack_require__("../node_modules/.pnpm/react-router-dom@5.3.0_react@17.0.2/node_modules/react-router-dom/esm/react-router-dom.js"),es=__webpack_require__("../node_modules/.pnpm/use-react-router-breadcrumbs@2.0.2_react-router@5.2.1+react@17.0.2/node_modules/use-react-router-breadcrumbs/dist/es/index.js"),AuthParameters=__webpack_require__("./src/aspects/GQL/AuthParameters.tsx"),jsx_runtime=__webpack_require__("../node_modules/.pnpm/react@17.0.2/node_modules/react/jsx-runtime.js");function Breadcrumbs(){var conference=(0,useConference.fk)(),subconferenceId=(0,AuthParameters.h)().subconferenceId,confTitle=(0,react.useMemo)((function(){var _ref,_conference$subconfer;return null!==(_ref=subconferenceId?null===(_conference$subconfer=conference.subconferences.find((function(x){return x.id===subconferenceId})))||void 0===_conference$subconfer?void 0:_conference$subconfer.shortName:void 0)&&void 0!==_ref?_ref:conference.shortName}),[conference.shortName,conference.subconferences,subconferenceId]),routes=(0,react.useMemo)((function(){return[{path:"/conference/:slug/manage",breadcrumb:"Manage "+confTitle},{path:"/c/:slug/manage",breadcrumb:"Manage "+confTitle},{path:"/conference/:slug/manage/export/youtube",breadcrumb:"YouTube"},{path:"/c/:slug/manage/export/youtube",breadcrumb:"YouTube"},{path:"/conference/:slug/manage/export/download-videos",breadcrumb:"Download videos"},{path:"/c/:slug/manage/export/download-videos",breadcrumb:"Download videos"}]}),[confTitle]),breadcrumbs=(0,es.Z)(routes,{excludePaths:["/","/conference","/c","/conference/:slug","/c/:slug"]});return(0,jsx_runtime.jsx)(chakra_ui_breadcrumb_esm.aG,{separator:">",children:breadcrumbs.map((function(breadcrumb){return(0,jsx_runtime.jsx)(chakra_ui_breadcrumb_esm.gN,{isCurrentPage:breadcrumb.key===breadcrumb.location.key,children:(0,jsx_runtime.jsx)(chakra_ui_breadcrumb_esm.At,{as:react_router_dom.rU,to:breadcrumb.key,children:breadcrumb.breadcrumb})},breadcrumb.key)}))})}function DashboardHeaderControls(_ref){var children=_ref.children;return children?(0,jsx_runtime.jsx)(chakra_ui_layout_esm.Ug,{spacing:4,mb:4,children}):(0,jsx_runtime.jsx)(jsx_runtime.Fragment,{})}Breadcrumbs.displayName="Breadcrumbs";try{DashboardHeaderControls.displayName="DashboardHeaderControls",DashboardHeaderControls.__docgenInfo={description:"",displayName:"DashboardHeaderControls",props:{}},"undefined"!=typeof STORYBOOK_REACT_CLASSES&&(STORYBOOK_REACT_CLASSES["src/aspects/Conference/Manage/DashboardHeaderControls.tsx#DashboardHeaderControls"]={docgenInfo:DashboardHeaderControls.__docgenInfo,name:"DashboardHeaderControls",path:"src/aspects/Conference/Manage/DashboardHeaderControls.tsx#DashboardHeaderControls"})}catch(__react_docgen_typescript_loader_error){}var SubconferenceSelector=__webpack_require__("./src/aspects/Conference/Manage/Subconferences/SubconferenceSelector.tsx");function DashboardPage(_ref){var title=_ref.title,children=_ref.children,controls=_ref.controls,_ref$stickyHeader=_ref.stickyHeader,stickyHeader=void 0===_ref$stickyHeader||_ref$stickyHeader,_ref$autoOverflow=_ref.autoOverflow,autoOverflow=void 0===_ref$autoOverflow||_ref$autoOverflow,conference=(0,useConference.fk)(),grayBg=(0,chakra_ui_color_mode_esm.ff)("gray.50","gray.900"),grayBorder=(0,chakra_ui_color_mode_esm.ff)("gray.300","gray.600"),titleEl=(0,useTitle.Z)(title.includes(conference.shortName)?title:title+" - "+conference.shortName);return(0,jsx_runtime.jsxs)(chakra_ui_layout_esm.kC,{flexDir:"column",w:{base:"100%",xl:"80%"},px:[2,2,4],children:[titleEl,(0,jsx_runtime.jsxs)(chakra_ui_layout_esm.xu,{position:stickyHeader?"sticky":void 0,top:0,left:0,zIndex:1e5,bgColor:grayBg,pt:4,borderBottom:"1px solid",borderBottomColor:grayBorder,children:[(0,jsx_runtime.jsx)(Breadcrumbs,{}),(0,jsx_runtime.jsxs)(chakra_ui_layout_esm.Ug,{children:[(0,jsx_runtime.jsx)(chakra_ui_layout_esm.X6,{id:"page-heading",as:"h1",size:"xl",textAlign:"left",mt:4,mb:4,children:title}),(0,jsx_runtime.jsx)(chakra_ui_layout_esm.LZ,{}),(0,jsx_runtime.jsx)(SubconferenceSelector.B,{})]}),(0,jsx_runtime.jsx)(DashboardHeaderControls,{children:controls})]}),(0,jsx_runtime.jsx)(chakra_ui_layout_esm.kC,{flexDir:"column",mt:4,w:"100%",overflow:autoOverflow?"auto":void 0,children})]})}DashboardPage.displayName="DashboardPage";try{DashboardPage.displayName="DashboardPage",DashboardPage.__docgenInfo={description:"",displayName:"DashboardPage",props:{title:{defaultValue:null,description:"",name:"title",required:!0,type:{name:"string"}},stickyHeader:{defaultValue:{value:"true"},description:"",name:"stickyHeader",required:!1,type:{name:"boolean"}},autoOverflow:{defaultValue:{value:"true"},description:"",name:"autoOverflow",required:!1,type:{name:"boolean"}},controls:{defaultValue:null,description:"",name:"controls",required:!1,type:{name:"ReactChild[]"}}}},"undefined"!=typeof STORYBOOK_REACT_CLASSES&&(STORYBOOK_REACT_CLASSES["src/aspects/Conference/Manage/DashboardPage.tsx#DashboardPage"]={docgenInfo:DashboardPage.__docgenInfo,name:"DashboardPage",path:"src/aspects/Conference/Manage/DashboardPage.tsx#DashboardPage"})}catch(__react_docgen_typescript_loader_error){}},"./src/aspects/Conference/Manage/Email/ManageEmail.tsx":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{__webpack_require__.r(__webpack_exports__),__webpack_require__.d(__webpack_exports__,{default:()=>ManageEmail});var _templateObject,chakra_ui_layout_esm=__webpack_require__("../node_modules/.pnpm/@chakra-ui+layout@1.7.4_d5de66fc214059f645050e36d066c00a/node_modules/@chakra-ui/layout/dist/chakra-ui-layout.esm.js"),react=__webpack_require__("../node_modules/.pnpm/react@17.0.2/node_modules/react/index.js"),DashboardPage=__webpack_require__("./src/aspects/Conference/Manage/DashboardPage.tsx"),chakra_ui_spinner_esm=(__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.array.slice.js"),__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.array.is-array.js"),__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.object.to-string.js"),__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.symbol.iterator.js"),__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.string.iterator.js"),__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.array.iterator.js"),__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/web.dom-collections.iterator.js"),__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.function.name.js"),__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.array.from.js"),__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.array.find.js"),__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.symbol.js"),__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.symbol.description.js"),__webpack_require__("../node_modules/.pnpm/@chakra-ui+spinner@1.2.4_d5de66fc214059f645050e36d066c00a/node_modules/@chakra-ui/spinner/dist/chakra-ui-spinner.esm.js")),chakra_ui_accordion_esm=__webpack_require__("../node_modules/.pnpm/@chakra-ui+accordion@1.4.6_381b254eb05ba0b21fa13fc526cde82c/node_modules/@chakra-ui/accordion/dist/chakra-ui-accordion.esm.js"),chakra_ui_button_esm=__webpack_require__("../node_modules/.pnpm/@chakra-ui+button@1.5.5_d5de66fc214059f645050e36d066c00a/node_modules/@chakra-ui/button/dist/chakra-ui-button.esm.js"),chakra_ui_form_control_esm=__webpack_require__("../node_modules/.pnpm/@chakra-ui+form-control@1.5.6_d5de66fc214059f645050e36d066c00a/node_modules/@chakra-ui/form-control/dist/chakra-ui-form-control.esm.js"),chakra_ui_input_esm=__webpack_require__("../node_modules/.pnpm/@chakra-ui+input@1.4.1_d5de66fc214059f645050e36d066c00a/node_modules/@chakra-ui/input/dist/chakra-ui-input.esm.js"),chakra_ui_textarea_esm=__webpack_require__("../node_modules/.pnpm/@chakra-ui+textarea@1.2.6_d5de66fc214059f645050e36d066c00a/node_modules/@chakra-ui/textarea/dist/chakra-ui-textarea.esm.js"),auth=__webpack_require__("../packages/shared/shared-types/build/esm/auth.js"),esm_conferenceConfiguration=__webpack_require__("../packages/shared/shared-types/build/esm/conferenceConfiguration.js"),email=__webpack_require__("../packages/shared/shared-types/build/esm/email.js"),urql_core=__webpack_require__("../node_modules/.pnpm/@urql+core@2.4.1_graphql@15.7.2/node_modules/@urql/core/dist/urql-core.mjs"),graphql=__webpack_require__("./src/generated/graphql.tsx"),make_context=__webpack_require__("./src/aspects/GQL/make-context.ts"),QueryWrapper=__webpack_require__("./src/aspects/GQL/QueryWrapper.tsx"),useConference=__webpack_require__("./src/aspects/Conference/useConference.tsx"),jsx_runtime=__webpack_require__("../node_modules/.pnpm/react@17.0.2/node_modules/react/jsx-runtime.js");function _slicedToArray(arr,i){return function _arrayWithHoles(arr){if(Array.isArray(arr))return arr}(arr)||function _iterableToArrayLimit(arr,i){var _i=null==arr?null:"undefined"!=typeof Symbol&&arr[Symbol.iterator]||arr["@@iterator"];if(null==_i)return;var _s,_e,_arr=[],_n=!0,_d=!1;try{for(_i=_i.call(arr);!(_n=(_s=_i.next()).done)&&(_arr.push(_s.value),!i||_arr.length!==i);_n=!0);}catch(err){_d=!0,_e=err}finally{try{_n||null==_i.return||_i.return()}finally{if(_d)throw _e}}return _arr}(arr,i)||function _unsupportedIterableToArray(o,minLen){if(!o)return;if("string"==typeof o)return _arrayLikeToArray(o,minLen);var n=Object.prototype.toString.call(o).slice(8,-1);"Object"===n&&o.constructor&&(n=o.constructor.name);if("Map"===n||"Set"===n)return Array.from(o);if("Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n))return _arrayLikeToArray(o,minLen)}(arr,i)||function _nonIterableRest(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function _arrayLikeToArray(arr,len){(null==len||len>arr.length)&&(len=arr.length);for(var i=0,arr2=new Array(len);i<len;i++)arr2[i]=arr[i];return arr2}function ConfigureEmailTemplates(){var conference=(0,useConference.fk)(),context=(0,react.useMemo)((function(){var _makeContext;return(0,make_context.f)(((_makeContext={})[auth.k.Role]=auth.Z.ConferenceOrganizer,_makeContext),["conference_Configuration"])}),[]),conferenceConfigurationResult=_slicedToArray((0,graphql.sPY)({variables:{conferenceId:conference.id},context}),1)[0];return(0,jsx_runtime.jsx)(QueryWrapper.Z,{getter:function getter(result){return result.conference_Configuration},queryResult:conferenceConfigurationResult,children:function children(conferenceConfigurations){return(0,jsx_runtime.jsx)(ConfigureEmailTemplatesInner,{conferenceConfigurations})}})}function ConfigureEmailTemplatesInner(_ref){var conferenceConfigurations=_ref.conferenceConfigurations,conference=(0,useConference.fk)(),emailTemplateConfig_SubtitlesGenerated=(0,react.useMemo)((function(){var _conferenceConfigurat,conferenceConfiguration=null!==(_conferenceConfigurat=conferenceConfigurations.find((function(c){return c.key===graphql.jbg.EmailTemplateSubtitlesGenerated})))&&void 0!==_conferenceConfigurat?_conferenceConfigurat:null;return conferenceConfiguration&&(0,esm_conferenceConfiguration.Zu)(conferenceConfiguration.value)?conferenceConfiguration.value:null}),[conferenceConfigurations]),emailTemplateConfig_SubmissionRequest=(0,react.useMemo)((function(){var _conferenceConfigurat2,conferenceConfiguration=null!==(_conferenceConfigurat2=conferenceConfigurations.find((function(c){return c.key===graphql.jbg.EmailTemplateSubmissionRequest})))&&void 0!==_conferenceConfigurat2?_conferenceConfigurat2:null;return conferenceConfiguration&&(0,esm_conferenceConfiguration.Zu)(conferenceConfiguration.value)?conferenceConfiguration.value:null}),[conferenceConfigurations]),_useConfigureEmailTem4=_slicedToArray((0,graphql.UMZ)(),2),updateConferenceConfigurationResponse=_useConfigureEmailTem4[0],updateConferenceConfiguration=_useConfigureEmailTem4[1],update=(0,react.useCallback)((function(key){return function(newValue){var _headers;updateConferenceConfiguration({conferenceId:conference.id,key,value:newValue},{fetchOptions:{headers:(_headers={},_headers[auth.k.Role]=auth.Z.ConferenceOrganizer,_headers)}})}}),[conference.id,updateConferenceConfiguration]);return(0,jsx_runtime.jsxs)(jsx_runtime.Fragment,{children:[(0,jsx_runtime.jsx)(chakra_ui_layout_esm.xu,{minH:"3ex",py:4,children:updateConferenceConfigurationResponse.fetching?(0,jsx_runtime.jsxs)(chakra_ui_layout_esm.Ug,{spacing:2,children:[(0,jsx_runtime.jsx)(chakra_ui_layout_esm.xv,{children:"Saving"})," ",(0,jsx_runtime.jsx)(chakra_ui_spinner_esm.$,{})]}):updateConferenceConfigurationResponse.data?updateConferenceConfigurationResponse.error?(0,jsx_runtime.jsx)(chakra_ui_layout_esm.xv,{children:"Error saving changes."}):(0,jsx_runtime.jsx)(chakra_ui_layout_esm.xv,{children:"Changes saved."}):void 0}),(0,jsx_runtime.jsxs)(chakra_ui_accordion_esm.UQ,{w:"100%",allowToggle:!0,allowMultiple:!0,reduceMotion:!0,children:[(0,jsx_runtime.jsxs)(chakra_ui_accordion_esm.Qd,{children:[(0,jsx_runtime.jsxs)(chakra_ui_accordion_esm.KF,{children:[(0,jsx_runtime.jsx)(chakra_ui_accordion_esm.XE,{mr:2}),(0,jsx_runtime.jsx)(chakra_ui_layout_esm.X6,{as:"h3",size:"sm",textAlign:"left",fontWeight:"normal",children:"Submission request email"})]}),(0,jsx_runtime.jsx)(chakra_ui_accordion_esm.Hk,{children:(0,jsx_runtime.jsx)(EmailTemplateForm,{templateConfig:emailTemplateConfig_SubmissionRequest,templateDefaults:email.S,update:update(graphql.jbg.EmailTemplateSubmissionRequest),description:"This email is sent to people when requesting submissions. You can also customise this email before each time you send out requests."})})]}),(0,jsx_runtime.jsxs)(chakra_ui_accordion_esm.Qd,{children:[(0,jsx_runtime.jsxs)(chakra_ui_accordion_esm.KF,{children:[(0,jsx_runtime.jsx)(chakra_ui_accordion_esm.XE,{mr:2}),(0,jsx_runtime.jsx)(chakra_ui_layout_esm.X6,{as:"h3",size:"sm",textAlign:"left",fontWeight:"normal",children:"Subtitles notification email"})]}),(0,jsx_runtime.jsx)(chakra_ui_accordion_esm.Hk,{children:(0,jsx_runtime.jsx)(EmailTemplateForm,{templateConfig:emailTemplateConfig_SubtitlesGenerated,templateDefaults:email.d,update:update(graphql.jbg.EmailTemplateSubtitlesGenerated),description:"This email is sent to people automatically when subtitles have been generated for one of their items."})})]})]})]})}function EmailTemplateForm(_ref2){var templateConfig=_ref2.templateConfig,templateDefaults=_ref2.templateDefaults,update=_ref2.update,description=_ref2.description,_useState2=_slicedToArray((0,react.useState)(null),2),subjectTemplate=_useState2[0],setSubjectTemplate=_useState2[1],_useState4=_slicedToArray((0,react.useState)(null),2),htmlBodyTemplate=_useState4[0],setHtmlBodyTemplate=_useState4[1],subjectTemplateValue=(0,react.useMemo)((function(){var _ref3;return null!==(_ref3=null!=subjectTemplate?subjectTemplate:null==templateConfig?void 0:templateConfig.subjectTemplate)&&void 0!==_ref3?_ref3:templateDefaults.subjectTemplate}),[subjectTemplate,null==templateConfig?void 0:templateConfig.subjectTemplate,templateDefaults.subjectTemplate]),htmlBodyTemplateValue=(0,react.useMemo)((function(){var _ref4;return null!==(_ref4=null!=htmlBodyTemplate?htmlBodyTemplate:null==templateConfig?void 0:templateConfig.htmlBodyTemplate)&&void 0!==_ref4?_ref4:templateDefaults.htmlBodyTemplate}),[htmlBodyTemplate,null==templateConfig?void 0:templateConfig.htmlBodyTemplate,templateDefaults.htmlBodyTemplate]);return(0,react.useEffect)((function(){setSubjectTemplate(null)}),[null==templateConfig?void 0:templateConfig.subjectTemplate]),(0,react.useEffect)((function(){setHtmlBodyTemplate(null)}),[null==templateConfig?void 0:templateConfig.htmlBodyTemplate]),(0,jsx_runtime.jsxs)(chakra_ui_layout_esm.gC,{spacing:4,alignItems:"flex-start",children:[(0,jsx_runtime.jsx)(chakra_ui_layout_esm.xv,{children:description}),null!=templateDefaults&&templateDefaults.htmlBodyTemplate||null!=templateDefaults&&templateDefaults.subjectTemplate?(0,jsx_runtime.jsx)(chakra_ui_button_esm.zx,{colorScheme:"purple",size:"sm","aria-label":"Reset email text and subject line to defaults",onClick:function onClick(){return update({subjectTemplate:null,htmlBodyTemplate:null})},isDisabled:templateDefaults.htmlBodyTemplate===htmlBodyTemplateValue&&templateDefaults.subjectTemplate===subjectTemplateValue,children:"Reset to default"}):void 0,(0,jsx_runtime.jsxs)(chakra_ui_form_control_esm.NI,{children:[(0,jsx_runtime.jsx)(chakra_ui_form_control_esm.lX,{children:"Subject"}),(0,jsx_runtime.jsx)(chakra_ui_input_esm.II,{value:subjectTemplateValue,onChange:function onChange(event){return setSubjectTemplate(event.target.value)},onBlur:function onBlur(){subjectTemplate&&subjectTemplateValue!==(null==templateConfig?void 0:templateConfig.subjectTemplate)&&update({subjectTemplate:subjectTemplateValue,htmlBodyTemplate:htmlBodyTemplateValue})}})]}),(0,jsx_runtime.jsxs)(chakra_ui_form_control_esm.NI,{mt:4,children:[(0,jsx_runtime.jsx)(chakra_ui_form_control_esm.lX,{children:"Body"}),(0,jsx_runtime.jsx)(chakra_ui_textarea_esm.g,{fontFamily:"monospace",lineHeight:"lg",minH:"md",value:htmlBodyTemplateValue,onChange:function onChange(event){return setHtmlBodyTemplate(event.target.value)},onBlur:function onBlur(){htmlBodyTemplate&&htmlBodyTemplateValue!==(null==templateConfig?void 0:templateConfig.htmlBodyTemplate)&&update({subjectTemplate:subjectTemplateValue,htmlBodyTemplate:htmlBodyTemplateValue})}})]})]})}(0,urql_core.Ps)(_templateObject||(_templateObject=function _taggedTemplateLiteralLoose(strings,raw){return raw||(raw=strings.slice(0)),strings.raw=raw,strings}(["\n    query ConfigureEmailTemplates_GetConferenceConfigurations($conferenceId: uuid!) {\n        conference_Configuration(where: { conferenceId: { _eq: $conferenceId } }) {\n            ...ConfigureEmailTemplates_ConferenceConfiguration\n        }\n    }\n\n    fragment ConfigureEmailTemplates_ConferenceConfiguration on conference_Configuration {\n        conferenceId\n        key\n        value\n    }\n\n    mutation ConfigureEmailTemplates_UpdateConferenceConfiguration(\n        $value: jsonb!\n        $conferenceId: uuid!\n        $key: conference_ConfigurationKey_enum!\n    ) {\n        insert_conference_Configuration_one(\n            object: { value: $value, conferenceId: $conferenceId, key: $key }\n            on_conflict: { constraint: Configuration_pkey, update_columns: value }\n        ) {\n            conferenceId\n            key\n            value\n        }\n    }\n"]))),ConfigureEmailTemplates.displayName="ConfigureEmailTemplates",EmailTemplateForm.displayName="EmailTemplateForm";try{ConfigureEmailTemplatesInner.displayName="ConfigureEmailTemplatesInner",ConfigureEmailTemplatesInner.__docgenInfo={description:"",displayName:"ConfigureEmailTemplatesInner",props:{conferenceConfigurations:{defaultValue:null,description:"",name:"conferenceConfigurations",required:!0,type:{name:"readonly ConfigureEmailTemplates_ConferenceConfigurationFragment[]"}}}},"undefined"!=typeof STORYBOOK_REACT_CLASSES&&(STORYBOOK_REACT_CLASSES["src/aspects/Conference/Manage/Email/ConfigureEmailTemplates.tsx#ConfigureEmailTemplatesInner"]={docgenInfo:ConfigureEmailTemplatesInner.__docgenInfo,name:"ConfigureEmailTemplatesInner",path:"src/aspects/Conference/Manage/Email/ConfigureEmailTemplates.tsx#ConfigureEmailTemplatesInner"})}catch(__react_docgen_typescript_loader_error){}function ManageEmail(){return(0,jsx_runtime.jsx)(DashboardPage.Y,{title:"Email",children:(0,jsx_runtime.jsx)(chakra_ui_layout_esm.W2,{maxW:"container.lg",children:(0,jsx_runtime.jsx)(chakra_ui_layout_esm.gC,{spacing:4,alignItems:"flex-start",mt:6,children:(0,jsx_runtime.jsx)(ConfigureEmailTemplates,{})})})})}ManageEmail.displayName="ManageEmail"},"./src/aspects/GQL/QueryWrapper.tsx":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{__webpack_require__.d(__webpack_exports__,{Z:()=>QueryWrapper});var _chakra_ui_react__WEBPACK_IMPORTED_MODULE_4__=__webpack_require__("../node_modules/.pnpm/@chakra-ui+layout@1.7.4_d5de66fc214059f645050e36d066c00a/node_modules/@chakra-ui/layout/dist/chakra-ui-layout.esm.js"),react__WEBPACK_IMPORTED_MODULE_0__=__webpack_require__("../node_modules/.pnpm/react@17.0.2/node_modules/react/index.js"),_Chakra_CenteredSpinner__WEBPACK_IMPORTED_MODULE_1__=__webpack_require__("./src/aspects/Chakra/CenteredSpinner.tsx"),_useQueryErrorToast__WEBPACK_IMPORTED_MODULE_2__=__webpack_require__("./src/aspects/GQL/useQueryErrorToast.tsx"),react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__=__webpack_require__("../node_modules/.pnpm/react@17.0.2/node_modules/react/jsx-runtime.js");function QueryWrapper(_ref){var queryResult=_ref.queryResult,getter=_ref.getter,children=_ref.children,childrenNoData=_ref.childrenNoData,_ref$noSpinner=_ref.noSpinner,noSpinner=void 0!==_ref$noSpinner&&_ref$noSpinner,innerData=(0,react__WEBPACK_IMPORTED_MODULE_0__.useMemo)((function(){return"data"in queryResult&&queryResult.data?getter(queryResult.data):void 0}),[getter,queryResult]);return(0,_useQueryErrorToast__WEBPACK_IMPORTED_MODULE_2__.Z)("error"in queryResult?null==queryResult?void 0:queryResult.error:void 0,!1,"QueryWrapper"),(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.Fragment,{children:[queryResult.fetching||queryResult.stale&&!innerData?noSpinner?void 0:(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_Chakra_CenteredSpinner__WEBPACK_IMPORTED_MODULE_1__.Z,{caller:"QueryWrapper:35"}):queryResult&&"error"in queryResult&&queryResult.error?(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_4__.xv,{children:"An error occurred loading in data - please see further information in notifications."}):void 0,queryResult.fetching||queryResult.stale&&!innerData?void 0:innerData?children(innerData):childrenNoData?childrenNoData():(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.Fragment,{children:[(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_4__.xv,{children:"No data found"}),(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_3__.jsx)(_chakra_ui_react__WEBPACK_IMPORTED_MODULE_4__.xv,{children:"(You might not have permission to access this. Please contact your conference organisers if you think this is a mistake.)"})]})]})}try{QueryWrapper.displayName="QueryWrapper",QueryWrapper.__docgenInfo={description:"",displayName:"QueryWrapper",props:{queryResult:{defaultValue:null,description:"",name:"queryResult",required:!0,type:{name:"UseQueryState<TData, TVariables> | (OperationResult<TData, TVariables> & { fetching: boolean; stale: boolean; }) | { ...; }"}},getter:{defaultValue:null,description:"",name:"getter",required:!0,type:{name:"(data: TData) => TInnerData | null | undefined"}},childrenNoData:{defaultValue:null,description:"",name:"childrenNoData",required:!1,type:{name:"(() => ReactNode | ReactNode[])"}},noSpinner:{defaultValue:{value:"false"},description:"",name:"noSpinner",required:!1,type:{name:"boolean"}}}},"undefined"!=typeof STORYBOOK_REACT_CLASSES&&(STORYBOOK_REACT_CLASSES["src/aspects/GQL/QueryWrapper.tsx#QueryWrapper"]={docgenInfo:QueryWrapper.__docgenInfo,name:"QueryWrapper",path:"src/aspects/GQL/QueryWrapper.tsx#QueryWrapper"})}catch(__react_docgen_typescript_loader_error){}},"../packages/shared/shared-types/build/esm/conferenceConfiguration.js":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{__webpack_require__.d(__webpack_exports__,{Zu:()=>isEmailTemplate_BaseConfig});__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.array.is-array.js"),__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.array.join.js"),__webpack_require__("../node_modules/.pnpm/core-js@3.21.0/node_modules/core-js/modules/es.array.slice.js");var Conference_ConfigurationKey_Enum,typescript_is__WEBPACK_IMPORTED_MODULE_3__=__webpack_require__("../node_modules/.pnpm/typescript-is@0.19.0_typescript@4.5.5/node_modules/typescript-is/index.js");function isEmailTemplate_BaseConfig(data){return(0,typescript_is__WEBPACK_IMPORTED_MODULE_3__.is)(data,(function(object){function su__null__string_eu(object){return null===object?null:function _string(object){return"string"!=typeof object?{}:null}(object)}return function _0(object){return"object"!=typeof object||null===object||Array.isArray(object)?{}:"subjectTemplate"in object?(error=su__null__string_eu(object.subjectTemplate))?error:"htmlBodyTemplate"in object?(error=su__null__string_eu(object.htmlBodyTemplate))?error:null:{}:{};var error}(object)}))}!function(Conference_ConfigurationKey_Enum){Conference_ConfigurationKey_Enum.BackgroundVideos="BACKGROUND_VIDEOS",Conference_ConfigurationKey_Enum.ClowdrAppVersion="CLOWDR_APP_VERSION",Conference_ConfigurationKey_Enum.EmailTemplateSubmissionRequest="EMAIL_TEMPLATE_SUBMISSION_REQUEST",Conference_ConfigurationKey_Enum.EmailTemplateSubtitlesGenerated="EMAIL_TEMPLATE_SUBTITLES_GENERATED",Conference_ConfigurationKey_Enum.FillerVideos="FILLER_VIDEOS",Conference_ConfigurationKey_Enum.FrontendHost="FRONTEND_HOST",Conference_ConfigurationKey_Enum.InputLossSlate="INPUT_LOSS_SLATE",Conference_ConfigurationKey_Enum.RegistrationUrl="REGISTRATION_URL",Conference_ConfigurationKey_Enum.SupportAddress="SUPPORT_ADDRESS",Conference_ConfigurationKey_Enum.TechSupportAddress="TECH_SUPPORT_ADDRESS",Conference_ConfigurationKey_Enum.UploadAgreement="UPLOAD_AGREEMENT",Conference_ConfigurationKey_Enum.UploadCutoffTimestamp="UPLOAD_CUTOFF_TIMESTAMP"}(Conference_ConfigurationKey_Enum||(Conference_ConfigurationKey_Enum={}))},"../packages/shared/shared-types/build/esm/email.js":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{__webpack_require__.d(__webpack_exports__,{d:()=>EMAIL_TEMPLATE_SUBTITLES_GENERATED,S:()=>EMAIL_TEMPLATE_SUBMISSION_REQUEST});var EMAIL_TEMPLATE_SUBTITLES_GENERATED={htmlBodyTemplate:'<p>Dear {{person.name}},</p>\n<p>We have automatically generated subtitles for your content <em>{{file.name}}</em> ({{item.title}}) at {{conference.name}}.</p>\n<p>Automated subtitles aren\'t always accurate, so you can <a href="{{uploadLink}}">review and edit them here</a>.</p>',subjectTemplate:"{{{conference.shortName}}}: Subtitles generated for your {{{file.name}}} ({{{item.title}}})"},EMAIL_TEMPLATE_SUBMISSION_REQUEST={htmlBodyTemplate:'<p>Dear {{person.name}},</p>\n<p>\n    The organisers of {{conference.name}} are requesting that you or\n    your co-authors/co-presenters submit your content to Midspace.\n</p>\n<p>\n    Please do not forward or share this email: anyone with the link contained\n    herein can use it to modify your submissions.\n</p>\n<p>\n    Please <a href="{{uploadLink}}">submit your content on this page</a> by 23:59 UTC on DD MMMM.\n</p>\n<p>\n    Please <a href="https://resources.midspace.app/video-subtitles/uploading-videos/">watch this 6 minute instructional video</a> to learn how to use Midspace\'s content upload system. This video also shows how to edit subtitles.\n</p>\n<p>\n    Please do not leave submitting to the last moment - this can be risky! If we are unable to automatically process your upload, it may not be possible to prepare it in time for the conference.\n</p>\n<p>\n    If you are uploading a video, Midspace will process it and auto-generate subtitles. You can then edit these subtitles.\n</p>\n<p>\n    We hope you enjoy your conference!\n<br/>\n</p>',subjectTemplate:"Submissions for {{{conference.shortName}}}"}},"../node_modules/.pnpm/use-react-router-breadcrumbs@2.0.2_react-router@5.2.1+react@17.0.2/node_modules/use-react-router-breadcrumbs/dist/es/index.js":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{__webpack_require__.d(__webpack_exports__,{Z:()=>__WEBPACK_DEFAULT_EXPORT__});var _babel_runtime_helpers_toConsumableArray__WEBPACK_IMPORTED_MODULE_2__=__webpack_require__("../node_modules/.pnpm/@babel+runtime@7.15.4/node_modules/@babel/runtime/helpers/esm/toConsumableArray.js"),react__WEBPACK_IMPORTED_MODULE_0__=__webpack_require__("../node_modules/.pnpm/react@17.0.2/node_modules/react/index.js"),react_router__WEBPACK_IMPORTED_MODULE_1__=__webpack_require__("../node_modules/.pnpm/react-router@5.2.1_react@17.0.2/node_modules/react-router/esm/react-router.js");var DEFAULT_MATCH_OPTIONS={exact:!0},humanize=function humanize(str){return str.replace(/^[\s_]+|[\s_]+$/g,"").replace(/[_\s]+/g," ").replace(/^[a-z]/,(function(m){return m.toUpperCase()}))},render=function render(_ref){var Breadcrumb=_ref.breadcrumb,match=_ref.match,location=_ref.location,props=_ref.props,componentProps=Object.assign({match,location,key:match.url},props||{});return Object.assign(Object.assign({},componentProps),{breadcrumb:"string"==typeof Breadcrumb?(0,react__WEBPACK_IMPORTED_MODULE_0__.createElement)("span",{key:componentProps.key},Breadcrumb):react__WEBPACK_IMPORTED_MODULE_0__.createElement(Breadcrumb,Object.assign({},componentProps))})},getBreadcrumbMatch=function getBreadcrumbMatch(_ref3){var breadcrumb,currentSection=_ref3.currentSection,disableDefaults=_ref3.disableDefaults,excludePaths=_ref3.excludePaths,location=_ref3.location,pathSection=_ref3.pathSection,routes=_ref3.routes;return excludePaths&&excludePaths.some((function getIsPathExcluded(path){return null!=(0,react_router__WEBPACK_IMPORTED_MODULE_1__.LX)(pathSection,{path,exact:!0,strict:!1})}))?"NO_BREADCRUMB":(routes.some((function(_a){var userProvidedBreadcrumb=_a.breadcrumb,matchOptions=_a.matchOptions,path=_a.path,rest=function __rest(s,e){var t={};for(var p in s)Object.prototype.hasOwnProperty.call(s,p)&&e.indexOf(p)<0&&(t[p]=s[p]);if(null!=s&&"function"==typeof Object.getOwnPropertySymbols){var i=0;for(p=Object.getOwnPropertySymbols(s);i<p.length;i++)e.indexOf(p[i])<0&&Object.prototype.propertyIsEnumerable.call(s,p[i])&&(t[p[i]]=s[p[i]])}return t}(_a,["breadcrumb","matchOptions","path"]);if(!path)throw new Error("useBreadcrumbs: `path` must be provided in every route object");var match=(0,react_router__WEBPACK_IMPORTED_MODULE_1__.LX)(pathSection,Object.assign(Object.assign({},matchOptions||DEFAULT_MATCH_OPTIONS),{path}));return match&&null===userProvidedBreadcrumb||!match&&matchOptions?(breadcrumb="NO_BREADCRUMB",!0):!!match&&(!userProvidedBreadcrumb&&disableDefaults?(breadcrumb="NO_BREADCRUMB",!0):(breadcrumb=render(Object.assign({breadcrumb:userProvidedBreadcrumb||humanize(currentSection),match,location},rest)),!0))})),breadcrumb||(disableDefaults?"NO_BREADCRUMB":function getDefaultBreadcrumb(_ref2){var currentSection=_ref2.currentSection,location=_ref2.location,pathSection=_ref2.pathSection,match=(0,react_router__WEBPACK_IMPORTED_MODULE_1__.LX)(pathSection,Object.assign(Object.assign({},DEFAULT_MATCH_OPTIONS),{path:pathSection}))||{url:"not-found"};return render({breadcrumb:humanize(currentSection),match,location})}({pathSection,currentSection:"/"===pathSection?"Home":currentSection,location})))},flattenRoutes=function flattenRoutes(routes){return routes.reduce((function(arr,route){return route.routes?arr.concat([route].concat((0,_babel_runtime_helpers_toConsumableArray__WEBPACK_IMPORTED_MODULE_2__.Z)(flattenRoutes(route.routes)))):arr.concat(route)}),[])};const __WEBPACK_DEFAULT_EXPORT__=function useReactRouterBreadcrumbs(routes,options){return function getBreadcrumbs(_ref4){var routes=_ref4.routes,location=_ref4.location,_ref4$options=_ref4.options,options=void 0===_ref4$options?{}:_ref4$options,matches=[];return location.pathname.split("?")[0].split("/").reduce((function(previousSection,currentSection,index){var pathSection=currentSection?"".concat(previousSection,"/").concat(currentSection):"/";if("/"===pathSection&&0!==index)return"";var breadcrumb=getBreadcrumbMatch(Object.assign({currentSection,location,pathSection,routes},options));return"NO_BREADCRUMB"!==breadcrumb&&matches.push(breadcrumb),"/"===pathSection?"":pathSection}),""),matches}({routes:flattenRoutes(routes||[]),location:(0,react_router__WEBPACK_IMPORTED_MODULE_1__.TH)(),options})}},"../node_modules/.pnpm/@babel+runtime@7.15.4/node_modules/@babel/runtime/helpers/esm/toConsumableArray.js":(__unused_webpack___webpack_module__,__webpack_exports__,__webpack_require__)=>{function _arrayLikeToArray(arr,len){(null==len||len>arr.length)&&(len=arr.length);for(var i=0,arr2=new Array(len);i<len;i++)arr2[i]=arr[i];return arr2}function _toConsumableArray(arr){return function _arrayWithoutHoles(arr){if(Array.isArray(arr))return _arrayLikeToArray(arr)}(arr)||function _iterableToArray(iter){if("undefined"!=typeof Symbol&&null!=iter[Symbol.iterator]||null!=iter["@@iterator"])return Array.from(iter)}(arr)||function _unsupportedIterableToArray(o,minLen){if(o){if("string"==typeof o)return _arrayLikeToArray(o,minLen);var n=Object.prototype.toString.call(o).slice(8,-1);return"Object"===n&&o.constructor&&(n=o.constructor.name),"Map"===n||"Set"===n?Array.from(o):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?_arrayLikeToArray(o,minLen):void 0}}(arr)||function _nonIterableSpread(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}__webpack_require__.d(__webpack_exports__,{Z:()=>_toConsumableArray})}}]);