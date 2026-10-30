# Copyright (c) 2026, Eagle Automate and contributors
# For license information, please see license.txt

"""Sites that installed Folio before starter pages existed get the Getting Started space once."""

from folio.starter import create_starter_pages


def execute():
	create_starter_pages()
