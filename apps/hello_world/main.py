from pairio.sdk import App, ProcessorBase, BaseModel

app = App(
    app_name='hello_world',
    description='A simple hello world app'
)

class HelloWorldProcessorContext(BaseModel):
    pass

class HelloWorldProcessor(ProcessorBase):
    name = 'hello_world'
    description = 'A simple hello world processor'
    label = 'Hello World'
    image = 'magland/pairio-hello-world:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: HelloWorldProcessorContext
    ):
        print('Hello world!')
        return

app.add_processor(HelloWorldProcessor)

if __name__ == '__main__':
    app.run()
