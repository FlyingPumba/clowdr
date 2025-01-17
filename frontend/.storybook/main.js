const path = require("path");

const toPath = (_path) => path.join(process.cwd(), _path);

module.exports = {
    stories: ["../src/**/*.stories.mdx", "../src/**/*.stories.@(js|jsx|ts|tsx)"],
    addons: [
        "@storybook/addon-links",
        "@storybook/addon-essentials",
        "@chakra-ui/storybook-addon",
        "@storybook/addon-a11y",
    ],
    framework: "@storybook/react",
    core: {
        builder: "webpack5",
    },
    webpackFinal: async (config) => {
        return {
            ...config,
            resolve: {
                ...config.resolve,
                alias: {
                    ...config.resolve.alias,
                    "@emotion/core": toPath("node_modules/@emotion/react"),
                    "emotion-theming": toPath("node_modules/@emotion/react"),
                },
            },
        };
    },
};
