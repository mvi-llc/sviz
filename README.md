[![Accelerate your robotics development](https://user-images.githubusercontent.com/14011012/195918769-5aaeedf3-5de2-48fb-951e-7399f2b9e190.png)](https://foxglove.dev)

<br/>

<div align="center">
  <h1>sviz</h1>
  <br />
  <br />

sviz is an integrated visualization and diagnosis tool for robotics, available [in your browser](https://sviz.metaverseindustries.llc/).

  <p align="center">
    <a href="https://sviz.metaverseindustries.llc"><img alt="sviz screenshot" src="/resources/screenshot.png"></a>
  </p>
</div>

<hr />

## Installation

Use the live deployment at [sviz.metaverseindustries.llc](https://sviz.metaverseindustries.llc/) or build the project from source and deploy the contents of `web/.webpack` to a web server.

## Open Source

sviz is primarily written in TypeScript – contributions are welcome!

The official binary distributions available at [studio.foxglove.dev](https://studio.foxglove.dev/) or [foxglove.dev/download](https://foxglove.dev/download) incorporate some closed-source functionality, such as integration with [Foxglove Data Platform](https://foxglove.dev/data-platform), multiple layouts, private extensions, and more. For more information on free and paid features, see our [Pricing](https://foxglove.dev/pricing).

## Self-hosting

Foxglove Studio can be self-hosted using our [docker image](https://ghcr.io/foxglove/studio). Please note that this build does not contain any closed source functionality.

```sh
docker run --rm -p "8080:8080" ghcr.io/foxglove/studio:latest
```

Foxglove Studio will be accessible in your browser at [localhost:8080](http://localhost:8080/).

### Overriding the default layout

[Bind-mount](https://docs.docker.com/storage/bind-mounts/) a layout JSON file at `/foxglove/default-layout.json` to set the default layout used when loading Studio from the Docker image.

```sh
docker run --rm -p "8080:8080" -v /path/to/custom_layout.json:/foxglove/default-layout.json ghcr.io/foxglove/studio:latest
```

### Self-hosted extensions

You can deliver a fixed set of extensions when self-hosting by [bind-mounting](https://docs.docker.com/storage/bind-mounts/) a directory containing one or more `.foxe` extensions and a `manifest.json` to `/src/extensions`. The format for the manifest JSON is as follows:

```json
{
  "packages": {
    "<extension-id>": {
      "url": "/extensions/<filename>.foxe",
      "config": {
        "name": "<extension-name>",
        "displayName": "...",
        "...": "..."
      }
    }
  }
}
```

## Contributing

Foxglove Studio is written in TypeScript – contributions are welcome!

Note: All contributors must agree to our [Contributor License Agreement](https://github.com/foxglove/cla). See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

## Credits

sviz is a fork of [Foxglove Studio](https://github.com/foxglove/studio), which originally began as a fork of [Webviz](https://github.com/cruise-automation/webviz), an open source project developed by [Cruise](https://getcruise.com/).
