from pairio.sdk import App, ProcessorBase, BaseModel, OutputFile

app = App(
    app_name='hello_world',
    description='A simple hello world app'
)

class HelloWorld1ProcessorContext(BaseModel):
    pass

class HelloWorld1Processor(ProcessorBase):
    name = 'hello_world_1'
    description = 'Prints "Hello, world!"'
    label = 'hello_world_1'
    image = 'magland/pairio-hello-world:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: HelloWorld1ProcessorContext
    ):
        print('Hello, world!')

class HelloWorld2ProcessorContext(BaseModel):
    output: OutputFile

class HelloWorld2Processor(ProcessorBase):
    name = 'hello_world_2'
    description = 'Outputs a text file with "Hello, world!" in it'
    label = 'hello_world_2'
    image = 'magland/pairio-hello-world:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: HelloWorld2ProcessorContext
    ):
        with open('output.txt', 'w') as f:
            f.write('Hello, world!')
        context.output.upload('output.txt')

app.add_processor(HelloWorld1Processor)

if __name__ == '__main__':
    app.run()
