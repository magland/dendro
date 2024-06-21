import json
from pairio.sdk import App, ProcessorBase, BaseModel, InputFile, OutputFile

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

class CountCharactersProcessorContext(BaseModel):
    input: InputFile
    output: OutputFile


class CountCharactersProcessor(ProcessorBase):
    name = 'count_characters'
    description = 'Counts the number of characters in a text file'
    label = 'count_characters'
    image = 'magland/pairio-hello-world:0.1.0'
    executable = '/app/main.py'
    attributes = {}

    @staticmethod
    def run(
        context: CountCharactersProcessorContext
    ):
        context.input.download('input.txt')
        with open('input.txt', 'r') as f:
            txt = f.read()
        num_characters = len(txt)
        output = {
            'num_characters': num_characters
        }
        with open('output.json', 'w') as f:
            json.dump(output, f)

        context.output.upload('output.json')

app.add_processor(HelloWorld1Processor)
app.add_processor(HelloWorld2Processor)
app.add_processor(CountCharactersProcessor)

if __name__ == '__main__':
    app.run()
